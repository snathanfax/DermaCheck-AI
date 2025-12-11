import React from 'react';
import { AlertTriangle } from 'lucide-react';

export const Disclaimer: React.FC = () => {
  return (
    <div className="bg-amber-50 border border-[#DC143C] p-4 mb-6 rounded-lg shadow-sm">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-amber-800">
            Medical Disclaimer
          </h3>
          <div className="mt-2 text-sm text-amber-700">
            <p>
              This tool uses Artificial Intelligence to provide a preliminary analysis. 
              <strong>It is NOT a medical diagnosis.</strong> AI can make mistakes. 
              Always consult a certified dermatologist or medical professional for any skin concerns, 
              especially if a mole is changing, bleeding, or itching.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};