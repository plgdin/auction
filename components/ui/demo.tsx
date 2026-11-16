import { ExpandingSearchDock } from "@/components/ui/expanding-search-dock-shadcnui";

export default function Demo() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F3E5D2] p-8">
      <ExpandingSearchDock
        placeholder="Search vintage denim, leather jackets..."
        onSearch={(q) => console.log("Searching for:", q)}
      />
    </div>
  );
}
