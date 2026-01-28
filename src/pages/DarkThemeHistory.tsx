import DarkThemeLayout from "@/components/layout/DarkThemeLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { History as HistoryIcon, List, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

const DarkThemeHistory = () => {
  return (
    <DarkThemeLayout>
      <div className="container px-4 py-6">
        <h1 className="text-xl font-bold mb-4 text-[hsl(var(--dark-foreground))]">Win History</h1>

        <Tabs defaultValue="list" className="w-full">
          <TabsList className={cn(
            "w-full grid grid-cols-2",
            "bg-[hsl(var(--dark-surface-elevated))]"
          )}>
            <TabsTrigger 
              value="list" 
              className={cn(
                "text-sm text-[hsl(var(--dark-muted))]",
                "data-[state=active]:bg-[hsl(var(--dark-neon-primary))]",
                "data-[state=active]:text-[hsl(var(--dark-background))]"
              )}
            >
              <span className="flex items-center gap-1">
                <List className="h-4 w-4" />
                List View
              </span>
            </TabsTrigger>
            <TabsTrigger 
              value="new" 
              className={cn(
                "text-sm text-[hsl(var(--dark-muted))]",
                "data-[state=active]:bg-[hsl(var(--dark-neon-primary))]",
                "data-[state=active]:text-[hsl(var(--dark-background))]"
              )}
            >
              <span className="flex items-center gap-1">
                <ArrowUp className="h-4 w-4" />
                Newest First
              </span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="mt-6">
            <div className="flex flex-col items-center justify-center py-20 text-[hsl(var(--dark-muted))]">
              <HistoryIcon className="h-16 w-16 mb-4 opacity-30" />
              <p className="text-sm text-center">
                No winning items yet
                <br />
                Items with B tier or higher will be displayed here
              </p>
            </div>
          </TabsContent>

          <TabsContent value="new" className="mt-6">
            <div className="flex flex-col items-center justify-center py-20 text-[hsl(var(--dark-muted))]">
              <HistoryIcon className="h-16 w-16 mb-4 opacity-30" />
              <p className="text-sm text-center">
                No winning items yet
                <br />
                Items with B tier or higher will be displayed here
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DarkThemeLayout>
  );
};

export default DarkThemeHistory;
