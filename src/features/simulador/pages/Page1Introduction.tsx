import { usePresentation } from '@/features/simulador/contexts/PresentationContext';
import { Button } from '@/components/ui/button';
import { ChevronRight } from 'lucide-react';

/**
 * Page 1: Introdução - Premium Landing Page
 * Clean layout: Logo | Title | Button
 */
export default function Page1Introduction() {
  const { setCurrentPage } = usePresentation();

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 text-white flex flex-col overflow-hidden relative">
      {/* Geometric Background Pattern */}
      <div className="absolute inset-0 opacity-20">
        <svg className="w-full h-full" viewBox="0 0 1200 1200">
          <defs>
            <pattern id="dots" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
              <circle cx="50" cy="50" r="2" fill="#C9A961" opacity="0.3" />
            </pattern>
          </defs>
          <rect width="1200" height="1200" fill="url(#dots)" />
          {/* Geometric lines */}
          <line x1="0" y1="0" x2="300" y2="300" stroke="#C9A961" strokeWidth="1" opacity="0.15" />
          <line x1="1200" y1="0" x2="900" y2="300" stroke="#C9A961" strokeWidth="1" opacity="0.15" />
          <line x1="0" y1="1200" x2="300" y2="900" stroke="#C9A961" strokeWidth="1" opacity="0.15" />
          <line x1="1200" y1="1200" x2="900" y2="900" stroke="#C9A961" strokeWidth="1" opacity="0.15" />
        </svg>
      </div>

      {/* Content Container */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 sm:px-6">
        {/* Logo Section */}
        <div className="flex justify-center pt-10 pb-6">
          <img
            src="https://d2xsxph8kpxj0f.cloudfront.net/310519663373793064/MbYdjKi9oLBFAoyXFgLhEc/LogotipoDourado_891370fb.png"
            alt="DP Soluções"
            className="w-auto"
            style={{width: '240px', height: '240px'}}
          />
        </div>

        {/* Title Section */}
        <div className="text-center py-8 sm:py-10 flex-1 flex items-center justify-center">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-primary leading-tight max-w-xs sm:max-w-2xl mx-auto">
            Simulador estratégico<br />
            do consórcio
          </h1>
        </div>

        {/* Button Section */}
        <div className="py-20 sm:py-24">
          <Button
            onClick={() => setCurrentPage(2)}
            className="px-12 sm:px-16 py-3 sm:py-4 text-base sm:text-lg bg-primary hover:bg-primary/90 text-gray-950 font-medium rounded-2xl flex items-center gap-2 mx-auto transition-all duration-300 hover:shadow-lg hover:shadow-primary/20"
          >
            Iniciar simulação <ChevronRight className="w-5 h-5" />
          </Button>
        </div>

        {/* Bottom Spacing */}
        <div className="py-6 sm:py-8"></div>
      </div>
    </div>
  );
}
