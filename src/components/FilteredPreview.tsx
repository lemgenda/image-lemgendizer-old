/**
 * @file FilteredPreview.tsx
 * @description Renders an image with actual filters applied via CamanJS.
 */
import React, { useState, useEffect, useRef } from 'react';
import { applyImageFilter } from '../processors/filterProcessor';
import { IMAGE_FILTERS } from '../constants';
import '../styles/FilteredPreview.css';

interface FilteredPreviewProps {
    src: string;
    filter: string;
    alt?: string;
    className?: string;
    style?: React.CSSProperties;
    onLoad?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
    onError?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
}

/**
 * FilteredPreview component.
 * @component
 * @param {FilteredPreviewProps} props - Component props.
 * @returns {JSX.Element} The rendered filtered preview image.
 */
const FilteredPreview: React.FC<FilteredPreviewProps> = ({
    src,
    filter,
    alt = "",
    className = "",
    style = {},
    onLoad,
    onError
}) => {
    const [displayUrl, setDisplayUrl] = useState<string>(src);
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const lastProcessed = useRef<{ src: string, filter: string } | null>(null);
    const blobUrlRef = useRef<string | null>(null);
    const [prevSrc, setPrevSrc] = useState(src);

    // Sync displayUrl when src becomes empty (render phase)
    if (src !== prevSrc) {
        setPrevSrc(src);
        if (!src && displayUrl !== "") {
            setDisplayUrl("");
        }
    }

    useEffect(() => {
        // If no filter or source changed to empty
        if (!src) {
            // Handled in render phase
            return;
        }

        if (filter === IMAGE_FILTERS.NONE || !filter) {
            if (blobUrlRef.current) {
                URL.revokeObjectURL(blobUrlRef.current);
                blobUrlRef.current = null;
            }
            // eslint-disable-next-line react-hooks/set-state-in-effect
            if (displayUrl !== src) setDisplayUrl(src);
            lastProcessed.current = { src, filter: IMAGE_FILTERS.NONE };
            return;
        }

        // If already processed this exact combination
        if (lastProcessed.current?.src === src && lastProcessed.current?.filter === filter) {
            return;
        }

        let isMounted = true;
        const processImage = async () => {
            setIsProcessing(true);
            try {
                // Load source image
                const img = new Image();
                img.crossOrigin = "anonymous";

                await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = reject;
                    img.src = src;
                });

                if (!isMounted) return;

                // Apply filter
                const canvas = await applyImageFilter(img, filter);

                if (!isMounted) return;

                // Create blob URL
                canvas.toBlob((blob) => {
                    if (!isMounted || !blob) return;

                    const newBlobUrl = URL.createObjectURL(blob);

                    // Cleanup old blob
                    if (blobUrlRef.current) {
                        URL.revokeObjectURL(blobUrlRef.current);
                    }

                    blobUrlRef.current = newBlobUrl;
                    setDisplayUrl(newBlobUrl);
                    lastProcessed.current = { src, filter };
                    setIsProcessing(false);
                }, 'image/jpeg', 0.8);

            } catch (_err) {
                if (isMounted) {
                    setDisplayUrl(src); // Fallback to original
                    setIsProcessing(false);
                }
            }
        };

        processImage();

        return () => {
            isMounted = false;
        };
    }, [src, filter, displayUrl]);

    // Cleanup blob URL on unmount
    useEffect(() => {
        return () => {
            if (blobUrlRef.current) {
                URL.revokeObjectURL(blobUrlRef.current);
            }
        };
    }, []);

    return (
        <div className="filtered-preview-container">
            <img
                src={displayUrl}
                alt={alt}
                className={className}
                onLoad={onLoad}
                onError={onError}
                style={{
                    ...style,
                    filter: 'none', // We apply filter via CamanJS now
                    opacity: isProcessing ? 0.7 : 1,
                    transition: 'opacity 0.2s ease, filter 0.3s ease'
                }}
            />
            {isProcessing && (
                <div className="gallery-image-loading gallery-image-loading-overlay">
                    <div className="gallery-loading-spinner gallery-loading-spinner-size"></div>
                </div>
            )}
        </div>
    );
};

export default FilteredPreview;
