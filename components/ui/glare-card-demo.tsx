import { GlareCard } from "@/components/ui/glare-card";

export function GlareCardDemo() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
      <GlareCard className="flex flex-col items-center justify-center">
        <svg
          width="66"
          height="65"
          viewBox="0 0 66 65"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="h-14 w-14 text-white"
        >
          <path
            d="M8 8.05571C8 8.05571 54.9009 18.1782 57.8687 30.062C60.8365 41.9458 9.05432 57.4696 9.05432 57.4696"
            stroke="currentColor"
            strokeWidth="15"
            strokeMiterlimit="3.86874"
            strokeLinecap="round"
          />
        </svg>
      </GlareCard>
      <GlareCard className="flex flex-col items-center justify-center relative overflow-hidden">
        <img
          className="h-full w-full absolute inset-0 object-cover"
          src="https://images.unsplash.com/photo-1543076447-215ad9ba6923?auto=format&fit=crop&w=800&q=80"
          alt="Vintage leather archive"
        />
      </GlareCard>
      <GlareCard className="flex flex-col items-start justify-end py-8 px-6">
        <p className="font-bold text-white text-lg">The Archival Rail</p>
        <p className="font-normal text-base text-neutral-200 mt-4">
          Every piece has already lived a life. Discover authenticated garments and live drops.
        </p>
      </GlareCard>
    </div>
  );
}

export default GlareCardDemo;

