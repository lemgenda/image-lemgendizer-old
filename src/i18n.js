import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Translation resources
const resources = {
    en: {
        translation: {
            // App Titles
            'app.title': 'Image LemGendizer',
            'app.subtitle': 'Batch Image Processing & Optimization Tool',
            'app.version': 'Image LemGendizer v2.1.0',
            'app.processClientSide': 'All processing is done client-side',
            'app.imagesNeverLeave': 'Your images never leave your browser',

            // Upload Section
            'upload.dropZone.title': 'Drop images here or click to upload',
            'upload.dropZone.supported': 'Supports JPG, PNG, GIF, WebP, SVG, AVIF, TIFF, BMP, ICO',
            'upload.dropZone.processing': 'All processing happens in your browser',
            'upload.selectImages': 'Select Images',

            // Processing Mode
            'mode.title': 'Processing Mode',
            'mode.custom': 'Custom Processing',
            'mode.templates': 'Templates',
            'mode.customInfo': 'Custom Mode: Select MULTIPLE images for batch processing',
            'mode.templatesInfo': 'Templates Mode: Select ONE image to apply templates',

            // Compression Settings
            'compression.title': 'Compression',
            'compression.quality': 'Quality (1-100)',
            'compression.targetSize': 'Target File Size (KB, optional)',
            'compression.auto': 'Leave empty for auto',

            // Output Settings
            'output.title': 'Output Settings',
            'output.format': 'Output Format',
            'output.format.webp': 'WebP',
            'output.format.jpg': 'JPG',
            'output.format.png': 'PNG',
            'output.format.avif': 'AVIF',
            'output.format.original': 'Original',
            'output.selectAll': 'Select All Formats',
            'output.clearAll': 'Clear All',
            'output.multiFormatInfo': 'Select multiple formats to export each image in all selected formats',
            'output.rename': 'Batch Rename',
            'output.newFileName': 'New File Name',
            'output.newFileName.placeholder': 'e.g., product-image',

            // Resize
            'resize.title': 'Resize',
            'resize.switchToCrop': 'Crop Mode',
            'resize.switchToResize': 'Resize Mode',
            'resize.dimension': 'Resize Dimension (px)',
            'resize.helper': 'For portrait: sets height. For landscape: sets width. Aspect ratio maintained.',

            // Crop
            'crop.title': 'Crop',
            'crop.switchToStandard': 'Standard Crop',
            'crop.switchToSmart': 'Smart Crop',
            'crop.aiPowered': 'AI-powered: Detects main subject and crops intelligently',
            'crop.aiNeedsLoad': ' (AI model needs to load)',
            'crop.width': 'Crop Width (px)',
            'crop.height': 'Crop Height (px)',
            'crop.position': 'Crop Position',
            'crop.position.center': 'Center',
            'crop.position.topLeft': 'Top Left',
            'crop.position.top': 'Top',
            'crop.position.topRight': 'Top Right',
            'crop.position.left': 'Left',
            'crop.position.right': 'Right',
            'crop.position.bottomLeft': 'Bottom Left',
            'crop.position.bottom': 'Bottom',
            'crop.position.bottomRight': 'Bottom Right',
            'crop.helper': 'Image will be resized to fit dimensions, then cropped from selected position',
            'crop.smartBest': 'Smart crop works best with images containing clear subjects (people, objects, etc.)',

            // Operations (for summary)
            'operations.resized': 'Resized to {{dimension}}px',
            'operations.aiCrop': 'AI Smart Crop',
            'operations.standardCrop': 'Crop',
            'operations.compressed': 'Compressed ({{quality}}% quality)',
            'operations.renamed': 'Renamed to {{pattern}}',
            'operations.autoUpscaling': 'Auto Upscaling',
            'operations.templatesApplied_one': '{{count}} template applied',
            'operations.templatesApplied_other': '{{count}} templates applied',
            'operations.aiSmartCropping': 'AI Smart Cropping',

            // Templates
            'templates.title': 'Template Selection',
            'templates.note': 'Templates use center crop (not smart crop) for consistent sizing',
            'templates.selectAll': 'Select All Templates',
            'templates.clearAll': 'Clear All',
            'templates.selectCategory': 'All',
            'templates.deselectCategory': 'None',
            'templates.imageForTemplates': 'Image for Templates',
            'templates.noImageSelected': 'No image selected',
            'templates.selected': 'templates selected',
            'templates.filesToGenerate': 'files to generate',
            'templates.selectTemplates': 'Select templates to generate files',
            'templates.download': 'Download Template Images',
            'templates.eachGenerates': 'Web templates generate WebP + JPG/PNG, logo templates generate JPG/PNG based on transparency, and social media templates generate JPG only',
            'templates.selectImage': 'Please select an image from the gallery above to apply templates',

            // Image Gallery
            'gallery.title': 'Uploaded Images',
            'gallery.templatesMode': '(Templates mode: Click ONE image to select)',
            'gallery.selectAll': 'Select All',
            'gallery.deselectAll': 'Deselect All',
            'gallery.removeSelected': 'Remove Selected',
            'gallery.templateImage': 'TEMPLATE IMAGE',

            // Buttons & Actions
            'button.process': 'Download Custom Processed Images',
            'button.processing': 'Processing...',
            'button.loadingAI': 'Loading AI Model...',
            'button.ok': 'OK',
            'button.close': 'Close',
            'button.english': 'English',
            'button.croatian': 'Hrvatski',
            'button.imageCount_one': '{{count}} image',
            'button.imageCount_other': '{{count}} images',
            'button.formatCount_one': '{{count}} format',
            'button.formatCount_other': '{{count}} formats',
            'button.templateCount_one': '{{count}} template',
            'button.templateCount_other': '{{count}} templates',

            // Messages
            'message.success': 'Success',
            'message.error': 'Error',
            'message.warning': 'Warning',
            'message.removed': 'Removed',
            'message.successUpload_one': 'Successfully uploaded {{count}} image',
            'message.successUpload_other': 'Successfully uploaded {{count}} images',
            'message.removedImages': 'Selected images have been removed',
            'message.processingImages_one': 'Processing {{count}} image...',
            'message.processingImages_other': 'Processing {{count}} images...',
            'message.aiLoading': 'Please wait while AI model loads...',
            'message.errorSelectImages': 'Please select images to process',
            'message.errorSelectImage': 'Please select an image for templates',
            'message.errorSelectTemplate': 'Please select at least one template',
            'message.errorSelectFormat': 'Please select at least one output format',
            'message.errorProcessing': 'Error processing images',
            'message.errorApplying': 'Error applying templates',
            'message.successDownload': 'ZIP file downloaded successfully! Check your downloads folder.',
            'message.aiFailed': 'AI model could not be loaded. Using standard crop instead.',
            'message.aiTemplateFallback': 'AI model not available, using standard cropping for templates',
            'message.cleanupMemory': 'Clean up GPU memory? This may improve performance.',
            'message.memoryCleaned': 'GPU memory has been cleaned up.',
            'message.largeImageWarning': 'Large image detected. Using optimized processing to prevent memory issues.',

            // Loading States
            'loading.preparing': 'Preparing your ZIP file...',
            'loading.aiModel': 'Loading AI model for smart cropping...',
            'loading.oncePerSession': 'This only happens once per session',
            'loading.aiCropping': 'Applying AI smart cropping...',
            'loading.upscalingWhenNeeded': 'Processing (auto upscaling applied when needed)...',
            'loading.aiForTemplates': 'AI model loading for smart template cropping',
            'loading.aiForSmartCrop': 'AI model loading for smart crop',

            // Summary Modal
            'summary.title': 'Processing Complete',
            'summary.processingComplete': 'Image Processing Complete',
            'summary.mode': 'Processing Mode',
            'summary.imagesProcessed_one': '{{count}} image processed',
            'summary.imagesProcessed_other': '{{count}} images processed',
            'summary.formatsExported': 'Formats Exported',
            'summary.totalFiles_one': '{{count}} file generated',
            'summary.totalFiles_other': '{{count}} files generated',
            'summary.aiUsed': 'AI Processing Used',
            'summary.upscalingUsed': 'AI Upscaling',
            'summary.categoriesApplied': 'Categories Applied',
            'summary.operationsPerformed': 'Operations Performed',
            'summary.templatesApplied_one': '{{count}} template applied',
            'summary.templatesApplied_other': '{{count}} templates applied',
            'summary.downloadComplete': 'All files have been downloaded in the ZIP archive.',
            'summary.templatesNote': 'All {{count}} templates were processed with optimal cropping and upscaling.',
            'summary.yes': 'Yes',
            'summary.no': 'No',

            // Common words for pluralization
            'common.image_one': 'image',
            'common.image_other': 'images',
            'common.format_one': 'format',
            'common.format_other': 'formats',
            'common.template_one': 'template',
            'common.template_other': 'templates',

            // Footer
            'footer.createdBy': 'Created by',
            'footer.aiEnabled': 'AI Smart Crop enabled',

            // Modal Accessibility
            'modal.close': 'Close',
            'modal.clickOutside': 'Click outside to close',
            'modal.escKey': 'Press ESC to close',

            // Accessibility
            'accessibility.modal': 'Modal dialog',
            'accessibility.closeModal': 'Close modal dialog',

            // Template Categories
            'category.web': 'Web',
            'category.logo': 'Logo',
            'category.instagram': 'Instagram',
            'category.facebook': 'Facebook',
            'category.twitter': 'Twitter/X',
            'category.linkedin': 'LinkedIn',
            'category.youtube': 'YouTube',
            'category.pinterest': 'Pinterest',
            'category.tiktok': 'TikTok',

            // Template Names
            'template.WebHero': 'Hero',
            'template.WebBlog': 'Blog Featured',
            'template.WebContent': 'Content',
            'template.WebThumb': 'Thumbnail',
            'template.LogoRectangular': 'Rectangular',
            'template.LogoSquare': 'Square',
            'template.InstagramProfile': 'Profile',
            'template.InstagramSquare': 'Square',
            'template.InstagramPortrait': 'Portrait',
            'template.InstagramLandscape': 'Landscape',
            'template.InstagramStoriesReels': 'Stories & Reels',
            'template.FacebookProfile': 'Profile',
            'template.FacebookCoverBanner': 'Cover',
            'template.FacebookSharedImage': 'Shared',
            'template.FacebookSquarePost': 'Square',
            'template.FacebookStories': 'Stories',
            'template.XProfile': 'Profile',
            'template.XHeaderBanner': 'Header',
            'template.XLandscapePost': 'Landscape',
            'template.XSquarePost': 'Square',
            'template.XPortraitPost': 'Portrait',
            'template.LinkedInProfile': 'Profile',
            'template.LinkedInPersonalCover': 'Cover',
            'template.LinkedInLandscapePost': 'Landscape',
            'template.LinkedInSquarePost': 'Square',
            'template.LinkedInPortraitPost': 'Portrait',
            'template.YouTubeChannelIcon': 'Channel Icon',
            'template.YouTubeBanner': 'Banner',
            'template.YouTubeThumbnail': 'Thumbnail',
            'template.PinterestProfile': 'Profile',
            'template.PinterestStandardPin': 'Standard',
            'template.PinterestSquarePin': 'Square',
            'template.PinterestStoryPin': 'Story',
            'template.TikTokProfile': 'Profile',
            'template.TikTokVideoCover': 'Video Cover'
        }
    },
    hr: {
        translation: {
            // App Titles
            'app.title': 'Image LemGendizer',
            'app.subtitle': 'Alat za obradu i optimizaciju slika',
            'app.version': 'Image LemGendizer v2.1.0',
            'app.processClientSide': 'Sva obrada se vrši na klijentu',
            'app.imagesNeverLeave': 'Vaše slike nikada ne napuštaju preglednik',

            // Upload Section
            'upload.dropZone.title': 'Povucite slike ovdje ili kliknite za učitavanje',
            'upload.dropZone.supported': 'Podržava JPG, PNG, GIF, WebP, SVG, AVIF, TIFF, BMP, ICO',
            'upload.dropZone.processing': 'Sva obrada se odvija u vašem pregledniku',
            'upload.selectImages': 'Odaberi slike',

            // Processing Mode
            'mode.title': 'Način obrade',
            'mode.custom': 'Prilagođena obrada',
            'mode.templates': 'Predlošci',
            'mode.customInfo': 'Prilagođeni način: Odaberite VIŠE slika za grupnu obradu',
            'mode.templatesInfo': 'Način predložaka: Odaberite JEDNU sliku za primjenu predložaka',

            // Compression Settings
            'compression.title': 'Kompresija',
            'compression.quality': 'Kvaliteta (1-100)',
            'compression.targetSize': 'Ciljana veličina datoteke (KB, opcionalno)',
            'compression.auto': 'Ostavite prazno za automatsko',

            // Output Settings
            'output.title': 'Postavke izlaza',
            'output.format': 'Izlazni format',
            'output.format.webp': 'WebP',
            'output.format.jpg': 'JPG',
            'output.format.png': 'PNG',
            'output.format.avif': 'AVIF',
            'output.format.original': 'Original',
            'output.selectAll': 'Odaberi sve formate',
            'output.clearAll': 'Očisti sve',
            'output.multiFormatInfo': 'Odaberite više formata da biste izvezli svaku sliku u svim odabranim formatima',
            'output.rename': 'Grupno preimenovanje',
            'output.newFileName': 'Novi naziv datoteke',
            'output.newFileName.placeholder': 'npr., slika-proizvoda',

            // Resize
            'resize.title': 'Promjena veličine',
            'resize.switchToCrop': 'Obrezivanje',
            'resize.switchToResize': 'Promjena veličine',
            'resize.dimension': 'Dimenzija promjene veličine (px)',
            'resize.helper': 'Za portret: postavlja visinu. Za pejzaž: postavlja širinu. Omjer slike se održava.',

            // Crop
            'crop.title': 'Obrezivanje',
            'crop.switchToStandard': 'Standardno obrezivanje',
            'crop.switchToSmart': 'Pametno obrezivanje',
            'crop.aiPowered': 'AI-powered: Detektira glavni subjekt i pametno obrezuje',
            'crop.aiNeedsLoad': ' (AI model se treba učitati)',
            'crop.width': 'Širina obrezivanja (px)',
            'crop.height': 'Visina obrezivanja (px)',
            'crop.position': 'Pozicija obrezivanja',
            'crop.position.center': 'Sredina',
            'crop.position.topLeft': 'Gore lijevo',
            'crop.position.top': 'Gore',
            'crop.position.topRight': 'Gore desno',
            'crop.position.left': 'Lijevo',
            'crop.position.right': 'Desno',
            'crop.position.bottomLeft': 'Dolje lijevo',
            'crop.position.bottom': 'Dolje',
            'crop.position.bottomRight': 'Dolje desno',
            'crop.helper': 'Slika će se promijeniti veličinu da stane u dimenzije, zatim obrezati od odabrane pozicije',
            'crop.smartBest': 'Pametno obrezivanje najbolje funkcionira sa slikama koje imaju jasne subjekte (ljudi, objekti, itd.)',

            // Operations (for summary)
            'operations.resized': 'Promijenjena veličina na {{dimension}}px',
            'operations.aiCrop': 'Pametno AI obrezivanje',
            'operations.standardCrop': 'Obrezivanje',
            'operations.compressed': 'Komprimirano ({{quality}}% kvalitete)',
            'operations.renamed': 'Preimenovano u {{pattern}}',
            'operations.autoUpscaling': 'Automatsko povećavanje',
            'operations.templatesApplied_one': 'Primijenjen {{count}} predložak',
            'operations.templatesApplied_few': 'Primijenjena {{count}} predloška',
            'operations.templatesApplied_other': 'Primijenjeno {{count}} predložaka',
            'operations.aiSmartCropping': 'Pametno AI obrezivanje',

            // Templates
            'templates.title': 'Odabir predložaka',
            'templates.note': 'Predlošci koriste središnje obrezivanje (ne pametno) za konzistentne dimenzije',
            'templates.selectAll': 'Odaberi sve predloške',
            'templates.clearAll': 'Očisti sve',
            'templates.selectCategory': 'Sve',
            'templates.deselectCategory': 'Ništa',
            'templates.imageForTemplates': 'Slika za predloške',
            'templates.noImageSelected': 'Nije odabrana slika',
            'templates.selected': 'predložaka odabrano',
            'templates.filesToGenerate': 'datoteka za generiranje',
            'templates.selectTemplates': 'Odaberite predloške za generiranje datoteka',
            'templates.download': 'Preuzmi slike predložaka',
            'templates.eachGenerates': 'Web predlošci generiraju WebP + JPG/PNG, logo predlošci generiraju JPG/PNG ovisno o transparentnosti, a predlošci za društvene mreže generiraju samo JPG.',
            'templates.selectImage': 'Molimo odaberite sliku iz galerije iznad za primjenu predložaka',

            // Image Gallery
            'gallery.title': 'Učitane slike',
            'gallery.templatesMode': '(Način predložaka: Kliknite JEDNU sliku za odabir)',
            'gallery.selectAll': 'Odaberi sve',
            'gallery.deselectAll': 'Poništi odabir',
            'gallery.removeSelected': 'Ukloni odabrane',
            'gallery.templateImage': 'SLIKA ZA PREDLOŠKE',

            // Buttons & Actions
            'button.process': 'Preuzmi prilagođeno obrađene slike',
            'button.processing': 'Obrada...',
            'button.loadingAI': 'Učitavam AI model...',
            'button.ok': 'U redu',
            'button.close': 'Zatvori',
            'button.english': 'English',
            'button.croatian': 'Hrvatski',
            'button.imageCount_one': '{{count}} slika',
            'button.imageCount_few': '{{count}} slike',
            'button.imageCount_other': '{{count}} slika',
            'button.formatCount_one': '{{count}} format',
            'button.formatCount_few': '{{count}} formata',
            'button.formatCount_other': '{{count}} formata',
            'button.templateCount_one': '{{count}} predložak',
            'button.templateCount_few': '{{count}} predloška',
            'button.templateCount_other': '{{count}} predložaka',

            // Messages
            'message.success': 'Uspjeh',
            'message.error': 'Greška',
            'message.warning': 'Upozorenje',
            'message.removed': 'Uklonjeno',
            'message.successUpload_one': 'Uspješno učitano {{count}} slika',
            'message.successUpload_few': 'Uspješno učitano {{count}} slike',
            'message.successUpload_other': 'Uspješno učitano {{count}} slika',
            'message.removedImages': 'Odabrane slike su uklonjene',
            'message.processingImages_one': 'Obrađujem {{count}} sliku...',
            'message.processingImages_few': 'Obrađujem {{count}} slike...',
            'message.processingImages_other': 'Obrađujem {{count}} slika...',
            'message.aiLoading': 'Molimo pričekajte dok se AI model učitava...',
            'message.errorSelectImages': 'Molimo odaberite slike za obradu',
            'message.errorSelectImage': 'Molimo odaberite sliku za predloške',
            'message.errorSelectTemplate': 'Molimo odaberite barem jedan predložak',
            'message.errorSelectFormat': 'Molimo odaberite barem jedan izlazni format',
            'message.errorProcessing': 'Greška pri obradi slika',
            'message.errorApplying': 'Greška pri primjeni predložaka',
            'message.successDownload': 'ZIP datoteka uspješno preuzeta! Provjerite vašu mapu s preuzimanjima.',
            'message.aiFailed': 'AI model se nije mogao učitati. Koristim standardno obrezivanje umjesto toga.',
            'message.aiTemplateFallback': 'AI model nije dostupan, koristim standardno obrezivanje za predloške',
            'message.cleanupMemory': 'Očistiti GPU memoriju? Ovo može poboljšati performanse.',
            'message.memoryCleaned': 'GPU memorija je očišćena.',
            'message.largeImageWarning': 'Otkrivena velika slika. Koristim optimiziranu obradu kako bih spriječio probleme s memorijom.',

            // Loading States
            'loading.preparing': 'Pripremam vašu ZIP datoteku...',
            'loading.aiModel': 'Učitavam AI model za pametno obrezivanje...',
            'loading.oncePerSession': 'Ovo se događa samo jednom po sesiji',
            'loading.aiCropping': 'Primjenjujem pametno AI obrezivanje...',
            'loading.upscalingWhenNeeded': 'Obrada (automatsko povećavanje primijenjeno kada je potrebno)...',
            'loading.aiForTemplates': 'Učitavam AI model za pametno obrezivanje predložaka',
            'loading.aiForSmartCrop': 'Učitavam AI model za pametno obrezivanje',

            // Summary Modal
            'summary.title': 'Obrada Završena',
            'summary.processingComplete': 'Obrada slika završena',
            'summary.mode': 'Način obrade',
            'summary.imagesProcessed_one': 'Obrađena {{count}} slika',
            'summary.imagesProcessed_few': 'Obrađene {{count}} slike',
            'summary.imagesProcessed_other': 'Obrađeno {{count}} slika',
            'summary.formatsExported': 'Izvozni formati',
            'summary.totalFiles_one': 'Generirana {{count}} datoteka',
            'summary.totalFiles_few': 'Generirane {{count}} datoteke',
            'summary.totalFiles_other': 'Generirano {{count}} datoteka',
            'summary.aiUsed': 'AI obrada korištena',
            'summary.upscalingUsed': 'AI povećavanje',
            'summary.categoriesApplied': 'Primijenjene kategorije',
            'summary.operationsPerformed': 'Izvedene operacije',
            'summary.templatesApplied_one': 'Primijenjen {{count}} predložak',
            'summary.templatesApplied_few': 'Primijenjena {{count}} predloška',
            'summary.templatesApplied_other': 'Primijenjeno {{count}} predložaka',
            'summary.downloadComplete': 'Sve datoteke su preuzete u ZIP arhivi.',
            'summary.templatesNote': 'Svi {{count}} predložaka obrađeni su s optimalnim obrezivanjem i povećavanjem.',
            'summary.yes': 'Da',
            'summary.no': 'Ne',

            // Common words for pluralization
            'common.image_one': 'slika',
            'common.image_few': 'slike',
            'common.image_other': 'slika',
            'common.format_one': 'format',
            'common.format_few': 'formata',
            'common.format_other': 'formata',
            'common.template_one': 'predložak',
            'common.template_few': 'predloška',
            'common.template_other': 'predložaka',

            // Footer
            'footer.createdBy': 'Kreirao',
            'footer.aiEnabled': 'Pametno obrezivanje AI-om omogućeno',

            // Modal Accessibility
            'modal.close': 'Zatvori',
            'modal.clickOutside': 'Kliknite izvan da zatvorite',
            'modal.escKey': 'Pritisnite ESC da zatvorite',

            // Accessibility
            'accessibility.modal': 'Modalni dijalog',
            'accessibility.closeModal': 'Zatvori modalni dijalog',

            // Template Categories
            'category.web': 'Web',
            'category.logo': 'Logo',
            'category.instagram': 'Instagram',
            'category.facebook': 'Facebook',
            'category.twitter': 'Twitter/X',
            'category.linkedin': 'LinkedIn',
            'category.youtube': 'YouTube',
            'category.pinterest': 'Pinterest',
            'category.tiktok': 'TikTok',

            // Template Names
            'template.WebHero': 'Hero slika',
            'template.WebBlog': 'Istaknuti blog',
            'template.WebContent': 'Sadržajna slika',
            'template.WebThumb': 'Sličica (thumbnail)',
            'template.LogoRectangular': 'Pravokutni logo',
            'template.LogoSquare': 'Kvadratni logo',
            'template.InstagramProfile': 'Profilna slika',
            'template.InstagramSquare': 'Kvadratni post',
            'template.InstagramPortrait': 'Portretni post',
            'template.InstagramLandscape': 'Pejzažni post',
            'template.InstagramStoriesReels': 'Stories i Reels',
            'template.FacebookProfile': 'Profilna slika',
            'template.FacebookCoverBanner': 'Naslovna fotografija',
            'template.FacebookSharedImage': 'Podijeljena slika',
            'template.FacebookSquarePost': 'Kvadratni post',
            'template.FacebookStories': 'Facebook Stories',
            'template.XProfile': 'Profilna slika',
            'template.XHeaderBanner': 'Naslovna slika',
            'template.XLandscapePost': 'Pejzažni post',
            'template.XSquarePost': 'Kvadratni post',
            'template.XPortraitPost': 'Portretni post',
            'template.LinkedInProfile': 'Profilna slika',
            'template.LinkedInPersonalCover': 'Naslovna slika',
            'template.LinkedInLandscapePost': 'Pejzažni post',
            'template.LinkedInSquarePost': 'Kvadratni post',
            'template.LinkedInPortraitPost': 'Portretni post',
            'template.YouTubeChannelIcon': 'Ikona kanala',
            'template.YouTubeBanner': 'YouTube banner',
            'template.YouTubeThumbnail': 'Sličica videa',
            'template.PinterestProfile': 'Profilna slika',
            'template.PinterestStandardPin': 'Standardni pin',
            'template.PinterestSquarePin': 'Kvadratni pin',
            'template.PinterestStoryPin': 'Story pin',
            'template.TikTokProfile': 'Profilna slika',
            'template.TikTokVideoCover': 'Naslovnica videa'
        }
    }
};

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources,
        fallbackLng: 'en',
        interpolation: {
            escapeValue: false,
        },
        detection: {
            order: ['localStorage', 'navigator'],
            caches: ['localStorage'],
        },
        // Configure plural rules
        pluralSeparator: '_',
    });

export default i18n;