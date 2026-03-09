import { useState } from "react";
import { Upload, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

const VideoDropZone = () => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    "Extracting frames",
    "Transcribing audio",
    "Translating to English",
    "Analyzing with AI"
  ];

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    startProcessing();
  };

  const handleFileSelect = () => {
    startProcessing();
  };

  const startProcessing = () => {
    setIsProcessing(true);
    setActiveStep(0);
    
    // Simulate processing steps
    const interval = setInterval(() => {
      setActiveStep((prev) => {
        if (prev >= steps.length - 1) {
          clearInterval(interval);
          setTimeout(() => {
            setIsProcessing(false);
            setActiveStep(0);
          }, 1000);
          return prev;
        }
        return prev + 1;
      });
    }, 1500);
  };

  return (
    <section className="py-20 px-6" style={{ background: '#000000' }}>
      <div className="container mx-auto max-w-[680px]">
        <div className="text-center mb-8">
          <div className="text-[12px] tracking-[2px] uppercase mb-4" style={{ color: '#555' }}>
            TRY IT NOW
          </div>
          <h2 className="text-[32px] font-bold text-foreground mb-3">
            Drop a video. Get insights in 60 seconds.
          </h2>
          <p className="text-[16px]" style={{ color: '#666' }}>
            No account needed to try.
          </p>
        </div>

        <div
          className="relative rounded-2xl transition-all duration-200"
          style={{
            background: '#0a0a0a',
            border: `2px dashed ${isDragging ? '#ffffff' : '#333333'}`,
            padding: '64px 40px'
          }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {!isProcessing ? (
            <div className="flex flex-col items-center justify-center text-center">
              <Upload size={40} style={{ color: '#444' }} />
              <p className="text-[18px] mt-4" style={{ color: '#888' }}>
                Drop your video here
              </p>
              <p className="text-[14px] mt-2" style={{ color: '#555' }}>
                MP4, MOV, AVI, MKV up to 500MB
              </p>
              <div className="text-[14px] my-4" style={{ color: '#444' }}>
                or
              </div>
              <Button
                onClick={handleFileSelect}
                className="bg-transparent text-foreground hover:bg-card"
                style={{
                  padding: '10px 24px',
                  borderRadius: '6px',
                  border: '1px solid #333'
                }}
              >
                Browse files
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {steps.map((step, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 transition-all"
                  style={{
                    color: index <= activeStep ? '#ffffff' : '#444'
                  }}
                >
                  <div 
                    className="w-2 h-2 rounded-full"
                    style={{
                      background: index <= activeStep ? '#ffffff' : '#444',
                      animation: index === activeStep ? 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' : 'none'
                    }}
                  />
                  <span className="text-[16px]">{step}</span>
                  {index < activeStep && (
                    <Check size={16} className="ml-auto" />
                  )}
                </div>
              ))}
              
              {/* Progress bar */}
              <div className="mt-6 h-0.5 bg-[#222] rounded-full overflow-hidden">
                <div
                  className="h-full bg-white transition-all duration-1000 ease-linear"
                  style={{
                    width: `${((activeStep + 1) / steps.length) * 100}%`
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default VideoDropZone;
