/**
 * Type augmentation for @react-three/fiber v9+.
 *
 * R3F v9 uses `extend()` at runtime to register Three.js constructors
 * as JSX elements. This declaration file tells TypeScript about the
 * resulting JSX intrinsic elements (mesh, shaderMaterial, color, etc.).
 *
 * @see https://r3f.docs.pmnd.rs/tutorials/typescript
 */
import { ThreeElements } from '@react-three/fiber';

declare module 'react' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface HTMLAttributes<T> {}
}

declare global {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {}
  }
}
