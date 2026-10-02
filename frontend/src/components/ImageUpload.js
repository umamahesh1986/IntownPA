import React from "react";
import { ImagePlus, X } from "lucide-react";

// Base64 image/file uploader (placeholder storage for MVP).
export default function ImageUpload({ images = [], onChange, label = "Add photos", max = 5, testid = "image-upload" }) {
  const handleFiles = (e) => {
    const files = Array.from(e.target.files || []);
    files.slice(0, max - images.length).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => onChange([...(images || []), reader.result]);
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };
  const remove = (idx) => onChange(images.filter((_, i) => i !== idx));

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {(images || []).map((img, i) => (
          <div key={i} className="relative h-20 w-20 rounded-xl overflow-hidden border border-slate-200">
            <img src={img} alt="upload" className="h-full w-full object-cover" />
            <button type="button" onClick={() => remove(i)} data-testid={`${testid}-remove-${i}`}
              className="absolute top-0.5 right-0.5 bg-black/60 rounded-full p-0.5">
              <X className="h-3 w-3 text-white" />
            </button>
          </div>
        ))}
        {(images || []).length < max && (
          <label data-testid={testid}
            className="h-20 w-20 rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 cursor-pointer hover:border-orange-400 hover:text-orange-500 transition-colors">
            <ImagePlus className="h-5 w-5" />
            <span className="text-[10px] mt-1">{label}</span>
            <input type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />
          </label>
        )}
      </div>
    </div>
  );
}
