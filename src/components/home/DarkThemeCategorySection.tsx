import { cn } from "@/lib/utils";

// Categories with gradient backgrounds (wikibet style)
const categories = [
  { 
    id: "all", 
    label: "ALL", 
    sublabel: "Gacha",
    gradient: "from-purple-600 to-indigo-600",
    image: "https://images.unsplash.com/photo-1614850715649-1d0106293bd1?w=200&h=280&fit=crop"
  },
  { 
    id: "pokemon", 
    label: "POKEMON", 
    sublabel: "Cards",
    gradient: "from-yellow-500 to-orange-500",
    image: "https://images.unsplash.com/photo-1613771404784-3a5686aa2be3?w=200&h=280&fit=crop"
  },
  { 
    id: "yugioh", 
    label: "YU-GI-OH!", 
    sublabel: "Cards",
    gradient: "from-red-600 to-pink-600",
    image: "https://images.unsplash.com/photo-1642755017878-ebbb17016711?w=200&h=280&fit=crop"
  },
  { 
    id: "onepiece", 
    label: "ONE PIECE", 
    sublabel: "Cards",
    gradient: "from-cyan-500 to-blue-600",
    image: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=200&h=280&fit=crop"
  },
  { 
    id: "weiss", 
    label: "WEISS", 
    sublabel: "Schwarz",
    gradient: "from-green-500 to-emerald-600",
    image: "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=200&h=280&fit=crop"
  },
];

interface DarkThemeCategorySectionProps {
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
}

const DarkThemeCategorySection = ({ 
  selectedCategory, 
  onCategoryChange 
}: DarkThemeCategorySectionProps) => {
  return (
    <div className="bg-[hsl(var(--dark-background))] py-6">
      <div className="container px-4">
        {/* Section Title */}
        <h2 className="text-lg font-bold text-[hsl(var(--dark-foreground))] mb-4">
          Categories
        </h2>

        {/* Horizontal Scrolling Category Cards */}
        <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
          <div className="flex gap-4 pb-2">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => onCategoryChange(category.id)}
                className={cn(
                  "flex-shrink-0 relative w-32 h-44 rounded-xl overflow-hidden transition-all duration-300",
                  "hover:scale-105 hover:shadow-[0_0_30px_rgba(0,0,0,0.5)]",
                  selectedCategory === category.id && "ring-2 ring-[hsl(var(--dark-neon-primary))] shadow-[0_0_20px_hsl(var(--dark-neon-primary)/0.4)]"
                )}
              >
                {/* Background Gradient */}
                <div className={cn(
                  "absolute inset-0 bg-gradient-to-b",
                  category.gradient
                )} />

                {/* Image */}
                <div className="absolute inset-0">
                  <img 
                    src={category.image} 
                    alt={category.label}
                    className="w-full h-full object-cover opacity-60 mix-blend-overlay"
                  />
                </div>

                {/* Content Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

                {/* Text Content */}
                <div className="absolute bottom-0 left-0 right-0 p-3 text-center">
                  <p className="text-white font-bold text-sm tracking-wide drop-shadow-lg">
                    {category.label}
                  </p>
                  <p className="text-white/80 text-xs mt-0.5">
                    {category.sublabel}
                  </p>
                </div>

                {/* Selected indicator */}
                {selectedCategory === category.id && (
                  <div className="absolute top-2 right-2 w-3 h-3 rounded-full bg-[hsl(var(--dark-neon-primary))] shadow-[0_0_10px_hsl(var(--dark-neon-primary))]" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DarkThemeCategorySection;
