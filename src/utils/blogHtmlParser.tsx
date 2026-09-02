import React from 'react';
import { LinkPreview } from '../components/ui/link-preview';

// Helper to convert style string to react style object
const parseStyleString = (styleStr: string): Record<string, string> => {
  const styleObj: Record<string, string> = {};
  if (!styleStr) return styleObj;
  
  styleStr.split(';').forEach((style) => {
    const rule = style.trim();
    if (!rule) return;
    const separatorIndex = rule.indexOf(':');
    if (separatorIndex === -1) return;
    
    const prop = rule.substring(0, separatorIndex).trim();
    const val = rule.substring(separatorIndex + 1).trim();
    
    if (prop && val) {
      // camelCase style properties
      const camelProp = prop.replace(/-./g, (c) => c.substring(1).toUpperCase());
      styleObj[camelProp] = val;
    }
  });
  return styleObj;
};

/**
 * Lightweight, robust HTML sanitizer using native DOMParser.
 * Blocks dangerous tags (script, iframe, object, embed, form, base, svg, etc.) and
 * cleans event listener attributes (on*) and dangerous URL schemes.
 */
export function sanitizeHtml(htmlString: string): string {
  if (!htmlString) return '';
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');
  
  const BLOCKED_TAGS = [
    'script', 'iframe', 'object', 'embed', 'link', 'style', 'meta', 'base',
    'form', 'input', 'button', 'select', 'textarea', 'svg', 'math', 'applet',
    'frame', 'frameset', 'portal', 'template', 'shadow'
  ];

  const cleanNode = (node: Element) => {
    const tagName = node.tagName.toLowerCase();
    
    // Remove dangerous tags completely
    if (BLOCKED_TAGS.includes(tagName)) {
      node.remove();
      return;
    }
    
    // Clean dangerous attributes
    const attrs = Array.from(node.attributes);
    attrs.forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = attr.value.toLowerCase().trim();
      
      // Remove inline event handlers (onclick, onload, onerror, onmouseover, etc.)
      if (name.startsWith('on') || name.startsWith('data-on')) {
        node.removeAttribute(attr.name);
      }
      // Block javascript:, vbscript:, data:, file:, blob: protocols in href or src
      else if (name === 'href' || name === 'src' || name === 'action' || name === 'formaction') {
        const isDisallowedScheme = /^(javascript|vbscript|data|file|blob):/i.test(value);
        if (isDisallowedScheme && !value.startsWith('data:image/')) {
          node.removeAttribute(attr.name);
        }
      }
    });

    // Enforce noopener noreferrer on links
    if (tagName === 'a') {
      node.setAttribute('rel', 'noopener noreferrer');
      if (node.getAttribute('href')?.startsWith('http')) {
        node.setAttribute('target', '_blank');
      }
    }
    
    // Clean child elements recursively
    const children = Array.from(node.children);
    children.forEach(cleanNode);
  };
  
  if (doc.body) {
    const children = Array.from(doc.body.children);
    children.forEach(cleanNode);
    return doc.body.innerHTML;
  }
  
  return '';
}

export function parseHtmlWithLinkPreviews(htmlString: string): React.ReactNode[] {
  if (!htmlString) return [];
  
  const sanitized = sanitizeHtml(htmlString);
  const parser = new DOMParser();
  const doc = parser.parseFromString(sanitized, 'text/html');
  
  const domToReact = (node: Node, key: string): React.ReactNode => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent;
    }
    
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;
      const tagName = element.tagName.toLowerCase();
      
      // Get all attributes as an object
      const attrs: Record<string, string> = {};
      Array.from(element.attributes).forEach((attr) => {
        attrs[attr.name] = attr.value;
      });
      
      // If it's an anchor tag, replace it with LinkPreview!
      if (tagName === 'a' && attrs.href) {
        const customImage = attrs['data-image-src'] || attrs['data-preview-image'];
        const isStatic = !!customImage;
        
        return (
          <LinkPreview
            key={key}
            url={attrs.href}
            imageSrc={customImage || ''}
            isStatic={isStatic}
            className={attrs.class || 'font-bold text-primary hover:underline'}
          >
            {Array.from(element.childNodes).map((child, i) => 
              domToReact(child, `${key}-${i}`)
            )}
          </LinkPreview>
        );
      }
      
      // Convert class to className for React
      const reactProps: any = { key };
      Object.entries(attrs).forEach(([name, val]) => {
        if (name === 'class') {
          reactProps.className = val;
        } else if (name === 'style') {
          reactProps.style = parseStyleString(val);
        } else {
          // camelCase standard React properties
          const camelName = name === 'onclick' ? 'onClick' : name;
          reactProps[camelName] = val;
        }
      });
      
      const children = Array.from(element.childNodes).map((child, i) => 
        domToReact(child, `${key}-${i}`)
      );
      
      return React.createElement(tagName, reactProps, ...children);
    }
    
    return null;
  };
  
  return Array.from(doc.body.childNodes).map((child, i) => 
    domToReact(child, `root-${i}`)
  );
}
