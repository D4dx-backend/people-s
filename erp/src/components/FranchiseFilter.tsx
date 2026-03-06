import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCrossFranchise } from '@/hooks/useCrossFranchise';
import { Building2 } from 'lucide-react';

interface FranchiseFilterProps {
  className?: string;
}

export function FranchiseFilter({ className }: FranchiseFilterProps) {
  const { franchises, selectedFranchise, setSelectedFranchise, isCrossFranchise, isLoading } =
    useCrossFranchise();

  if (!isCrossFranchise || isLoading || franchises.length < 2) return null;

  return (
    <div className={className}>
      <Tabs value={selectedFranchise} onValueChange={setSelectedFranchise}>
        <TabsList>
          <TabsTrigger value="all" className="gap-1.5">
            <Building2 className="h-3.5 w-3.5" />
            All Branches
          </TabsTrigger>
          {franchises.map((f) => (
            <TabsTrigger key={f.id} value={f.id} className="gap-1.5">
              {f.logoUrl ? (
                <img src={f.logoUrl} alt="" className="h-4 w-4 rounded-full object-cover" />
              ) : (
                <Building2 className="h-3.5 w-3.5" />
              )}
              {f.displayName}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}

export default FranchiseFilter;
