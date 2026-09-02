import { useEffect } from 'react';

export interface PageSeoOptions {
  title: string;
  description: string;
  keywords?: string;
  canonicalPath?: string;
  ogImage?: string;
  ogType?: 'website' | 'article';
  structuredData?: Record<string, any>;
}

const DEFAULT_IMAGE = 'https://www.lelam.co/png_lelam_1.webp';
const BASE_URL = 'https://www.lelam.co';

export function updatePageSeo({
  title,
  description,
  keywords,
  canonicalPath = '',
  ogImage = DEFAULT_IMAGE,
  ogType = 'website',
  structuredData,
}: PageSeoOptions) {
  // 1. Title
  document.title = title.includes('Lelam') ? title : `${title} | Lelam`;

  // 2. Meta Description
  let metaDesc = document.querySelector('meta[name="description"]');
  if (!metaDesc) {
    metaDesc = document.createElement('meta');
    metaDesc.setAttribute('name', 'description');
    document.head.appendChild(metaDesc);
  }
  metaDesc.setAttribute('content', description);

  // 3. Keywords
  if (keywords) {
    let metaKeywords = document.querySelector('meta[name="keywords"]');
    if (!metaKeywords) {
      metaKeywords = document.createElement('meta');
      metaKeywords.setAttribute('name', 'keywords');
      document.head.appendChild(metaKeywords);
    }
    metaKeywords.setAttribute('content', keywords);
  }

  // 4. Canonical
  const cleanPath = canonicalPath.startsWith('/') ? canonicalPath : `/${canonicalPath}`;
  const canonicalUrl = `${BASE_URL}${cleanPath === '/' ? '' : cleanPath}`;
  let canonicalLink = document.querySelector('link[rel="canonical"]');
  if (!canonicalLink) {
    canonicalLink = document.createElement('link');
    canonicalLink.setAttribute('rel', 'canonical');
    document.head.appendChild(canonicalLink);
  }
  canonicalLink.setAttribute('href', canonicalUrl);

  // 5. Open Graph Meta Tags
  const setMetaProperty = (property: string, content: string) => {
    let el = document.querySelector(`meta[property="${property}"]`);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute('property', property);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  };

  setMetaProperty('og:title', title);
  setMetaProperty('og:description', description);
  setMetaProperty('og:url', canonicalUrl);
  setMetaProperty('og:image', ogImage);
  setMetaProperty('og:type', ogType);

  // 6. Twitter Meta Tags
  const setMetaName = (name: string, content: string) => {
    let el = document.querySelector(`meta[name="${name}"]`);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute('name', name);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  };

  setMetaName('twitter:title', title);
  setMetaName('twitter:description', description);
  setMetaName('twitter:image', ogImage);

  // 7. Structured Data (JSON-LD)
  const SCRIPT_ID = 'dynamic-page-jsonld';
  let jsonLdScript = document.getElementById(SCRIPT_ID);
  if (structuredData) {
    if (!jsonLdScript) {
      jsonLdScript = document.createElement('script');
      jsonLdScript.id = SCRIPT_ID;
      jsonLdScript.setAttribute('type', 'application/ld+json');
      document.head.appendChild(jsonLdScript);
    }
    jsonLdScript.textContent = JSON.stringify(structuredData);
  } else if (jsonLdScript) {
    jsonLdScript.remove();
  }
}

export function usePageSeo(options: PageSeoOptions, deps: any[] = []) {
  useEffect(() => {
    updatePageSeo(options);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
