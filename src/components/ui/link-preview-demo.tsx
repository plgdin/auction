import { LinkPreview } from "./link-preview";

export function LinkPreviewDemoSecond() {
  return (
    <div className="flex justify-center items-start h-[40rem] flex-col px-4 bg-slate-50 dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800">
      <p className="text-slate-500 dark:text-slate-400 text-xl md:text-3xl max-w-3xl text-left mb-10 leading-normal">
        Visit{" "}
        <LinkPreview
          url="https://ui.aceternity.com"
          className="font-bold bg-clip-text text-transparent bg-gradient-to-br from-purple-500 to-pink-500"
        >
          Aceternity UI
        </LinkPreview>{" "}
        for amazing Tailwind and Framer Motion components.
      </p>

      <p className="text-slate-500 dark:text-slate-400 text-xl md:text-3xl max-w-3xl text-left leading-normal">
        I listen to{" "}
        <LinkPreview
          url="https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=640&q=80"
          imageSrc="https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=640&q=80"
          isStatic
          className="font-bold text-slate-800 dark:text-slate-200"
        >
          good music
        </LinkPreview>{" "}
        and I watch{" "}
        <LinkPreview
          url="https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=640&q=80"
          imageSrc="https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=640&q=80"
          isStatic
          className="font-bold text-slate-800 dark:text-slate-200"
        >
          classic movies
        </LinkPreview>{" "}
        twice a day.
      </p>
    </div>
  );
}
