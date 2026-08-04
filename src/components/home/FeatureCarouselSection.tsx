import { ThreeDPhotoCarousel } from '../ui/3d-carousel';

export function FeatureCarouselSection() {
  return (
    <section className="py-12 md:py-16 w-full overflow-hidden">
      <div className="w-full text-center px-4 mb-6">
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
          Explore Catalogs & Features in 3D
        </h2>
      </div>

      <div className="w-full overflow-hidden">
        <ThreeDPhotoCarousel />
      </div>
    </section>
  );
}
