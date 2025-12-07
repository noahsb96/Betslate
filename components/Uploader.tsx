
import React, { useRef, useState } from 'react';
import { Upload, Loader2, Image as ImageIcon } from 'lucide-react';

interface UploaderProps {
  onImageSelected: (base64: string) => void;
  isLoading: boolean;
}

const Uploader: React.FC<UploaderProps> = ({ onImageSelected, isLoading }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setPreview(result);
        onImageSelected(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full">
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept="image/*" 
        className="hidden" 
      />
      
      <div 
        onClick={!isLoading ? triggerClick : undefined}
        className={`
          border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer transition-all
          ${isLoading ? 'border-blue-500 bg-blue-500/10 cursor-not-allowed' : 'border-gray-600 hover:border-blue-500 hover:bg-[#2f3136]'}
          bg-[#202225] h-64
        `}
      >
        {isLoading ? (
          <div className="text-center animate-pulse">
            <Loader2 className="w-12 h-12 text-blue-500 mx-auto mb-4 animate-spin" />
            <h3 className="text-lg font-bold text-white">AI is Analyzing Slate...</h3>
            <p className="text-gray-400 text-sm mt-2">Extracting matches, times, and hammers.</p>
          </div>
        ) : preview ? (
           <div className="relative w-full h-full flex flex-col items-center justify-center">
             <img src={preview} alt="Preview" className="max-h-48 rounded object-contain mb-2 opacity-50 hover:opacity-100 transition-opacity" />
             <p className="text-blue-400 text-sm font-semibold flex items-center">
                <ImageIcon size={16} className="mr-1" /> Click to upload a different slate
             </p>
           </div>
        ) : (
          <div className="text-center">
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-white">Upload Slate Screenshot</h3>
            <p className="text-gray-400 text-sm mt-2">Drag & drop or click to select</p>
            <p className="text-gray-500 text-xs mt-4">Supported: PNG, JPG, WEBP</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Uploader;
