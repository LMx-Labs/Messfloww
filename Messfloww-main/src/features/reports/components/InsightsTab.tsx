import React, { useEffect, useState } from 'react';
import { 
  generateSmartInsights,
  ReportData 
} from '../reportEngine';
import { RefreshCw, Lightbulb, AlertTriangle, TrendingUp, TrendingDown, Store } from 'lucide-react';

export function InsightsTab() {
  const [loading, setLoading] = useState(true);
  const [insightsData, setInsightsData] = useState<ReportData | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const iData = await generateSmartInsights();
        setInsightsData(iData);
      } catch (err) {
        console.error("Error fetching insights:", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <RefreshCw className="h-10 w-10 animate-spin mb-4 text-primary" />
        <p>Generating AI constraints & insights...</p>
      </div>
    );
  }

  const renderIcon = (type: string) => {
    switch (type) {
      case 'warning': return <AlertTriangle className="h-6 w-6 text-destructive" />;
      case 'success': return <TrendingUp className="h-6 w-6 text-green-500" />;
      case 'danger': return <TrendingDown className="h-6 w-6 text-red-600" />;
      default: return <Lightbulb className="h-6 w-6 text-accent" />;
    }
  };

  const renderColor = (type: string) => {
    switch (type) {
      case 'warning': return 'border-destructive/20 bg-destructive/5';
      case 'success': return 'border-green-500/20 bg-green-500/5';
      case 'danger': return 'border-red-600/20 bg-red-600/5';
      default: return 'border-accent/20 bg-accent/5';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* 10. Smart Insights Engine */}
      <div className="bg-card border border-border rounded-xl p-8 shadow-md relative overflow-hidden">
        {/* Decorative background element */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        
        <div className="relative z-10 flex items-start gap-4 mb-8">
          <div className="p-3 rounded-2xl bg-primary/10 text-primary">
            <Lightbulb className="h-8 w-8" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-foreground">Smart Insights Engine</h2>
            <p className="text-muted-foreground">Automated business intelligence based on historical and real-time data</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
          {insightsData?.data.topInsights ? (
             insightsData.data.topInsights.map((insight: any) => (
               <div key={insight.id} className={`p-5 rounded-xl border ${renderColor(insight.type)} flex flex-col justify-between h-full hover:shadow-md transition-shadow`}>
                 <div className="flex items-start gap-3 mb-4">
                   <div className="shrink-0 mt-1">
                     {renderIcon(insight.type)}
                   </div>
                   <div>
                     <h3 className="font-bold text-foreground text-lg">{insight.title}</h3>
                     <p className="text-sm text-foreground/80 mt-1">{insight.description}</p>
                   </div>
                 </div>
                 <div className="bg-background/80 px-4 py-2 rounded-lg text-sm font-semibold flex items-center justify-between border border-border">
                   <span className="text-muted-foreground">Recommendation:</span>
                   <span className="text-foreground">{insight.action}</span>
                 </div>
               </div>
             ))
          ) : (
            <div className="col-span-2 py-12 text-center border-2 border-dashed border-border rounded-xl text-muted-foreground">
               Engine Stub
            </div>
          )}
        </div>
      </div>

      {/* Grid: Underperforming, Waste, Demand */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col">
          <h3 className="font-bold text-foreground flex items-center gap-2 mb-4">
            <TrendingDown className="h-5 w-5 text-destructive" />
            Underperforming Items
          </h3>
          <div className="flex-1 flex items-center justify-center border border-dashed border-border rounded-lg bg-muted/20 text-muted-foreground text-sm py-8">
            Engine Stub
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col">
          <h3 className="font-bold text-foreground flex items-center gap-2 mb-4">
            <Store className="h-5 w-5 text-orange-500" />
            High Waste Alerts
          </h3>
          <div className="flex-1 flex items-center justify-center border border-dashed border-border rounded-lg bg-muted/20 text-muted-foreground text-sm py-8">
            Engine Stub
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col">
          <h3 className="font-bold text-foreground flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-primary" />
            Demand Prediction
          </h3>
          <div className="flex-1 flex items-center justify-center border border-dashed border-border rounded-lg bg-muted/20 text-muted-foreground text-sm py-8">
            Engine Stub
          </div>
        </div>

      </div>

    </div>
  );
}
