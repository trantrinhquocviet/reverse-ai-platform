import type {
  Video,
  Activity,
  DashboardStats,
  DatasetImage,
  DatasetStats,
  AIModel,
  Warehouse,
  Brand,
  UserProfile,
  ProcessingJob,
  Frame,
  OCRResult,
  Annotation,
  AnnotationReview,
  Feature,
  DatasetRecord,
  DatasetVersion,
  ProcessingLog,
  Notification,
  AIAnnotationSuggestion,
  AnnotationJob,
  KnowledgeRule,
  DuplicateGroup,
  AnnotationHistoryEntry,
  ReviewSession,
  AnnotationAnalytics,
  DatasetQualityScore,
  ActiveLearningFrame,
  TrainingTemplate,
  GPUNode,
  TrainingJob,
  Experiment,
  MetricPoint,
  ModelRegistryEntry,
  Deployment,
  EvaluationReport,
  BenchmarkResult,
} from '@/types'

export const mockVideos: Video[] = [
  {
    id: 'v1',
    name: 'warehouse-scan-2024-01-15.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=400&h=225&fit=crop',
    warehouse: 'WH-Central',
    brand: 'Nike',
    uploadTime: '2026-07-20T08:30:00Z',
    duration: '4:32',
    resolution: '1920x1080',
    status: 'Ready',
    fileSize: '245 MB',
  },
  {
    id: 'v2',
    name: 'inventory-check-north.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1553413077-190dd305871c?w=400&h=225&fit=crop',
    warehouse: 'WH-North',
    brand: 'Adidas',
    uploadTime: '2026-07-20T10:15:00Z',
    duration: '7:18',
    resolution: '1920x1080',
    status: 'Processing',
    fileSize: '412 MB',
  },
  {
    id: 'v3',
    name: 'zone-b-inspection.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=400&h=225&fit=crop',
    warehouse: 'WH-South',
    brand: 'Puma',
    uploadTime: '2026-07-19T14:22:00Z',
    duration: '3:45',
    resolution: '3840x2160',
    status: 'Ready',
    fileSize: '1.2 GB',
  },
  {
    id: 'v4',
    name: 'damaged-goods-review.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=225&fit=crop',
    warehouse: 'WH-East',
    brand: 'New Balance',
    uploadTime: '2026-07-19T09:00:00Z',
    duration: '2:10',
    resolution: '1280x720',
    status: 'Failed',
    fileSize: '98 MB',
  },
  {
    id: 'v5',
    name: 'shelf-restock-morning.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1565793979827-a5f5b67bc9f7?w=400&h=225&fit=crop',
    warehouse: 'WH-Central',
    brand: 'Under Armour',
    uploadTime: '2026-07-18T07:45:00Z',
    duration: '12:04',
    resolution: '1920x1080',
    status: 'Uploaded',
    fileSize: '678 MB',
  },
  {
    id: 'v6',
    name: 'quality-control-batch-7.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&h=225&fit=crop',
    warehouse: 'WH-West',
    brand: 'Reebok',
    uploadTime: '2026-07-18T13:30:00Z',
    duration: '5:55',
    resolution: '1920x1080',
    status: 'Ready',
    fileSize: '332 MB',
  },
  {
    id: 'v7',
    name: 'loading-dock-cam-02.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1605296867304-46d5465a13f1?w=400&h=225&fit=crop',
    warehouse: 'WH-North',
    brand: 'Nike',
    uploadTime: '2026-07-17T16:00:00Z',
    duration: '9:22',
    resolution: '1920x1080',
    status: 'Processing',
    fileSize: '520 MB',
  },
  {
    id: 'v8',
    name: 'aisle-3-evening-scan.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1580828343064-fde4fc206bc6?w=400&h=225&fit=crop',
    warehouse: 'WH-South',
    brand: 'Adidas',
    uploadTime: '2026-07-17T18:45:00Z',
    duration: '6:40',
    resolution: '1920x1080',
    status: 'Ready',
    fileSize: '375 MB',
  },
]

export const mockActivities: Activity[] = [
  {
    id: 'a1',
    type: 'upload',
    description: 'warehouse-scan-2024-01-15.mp4 uploaded successfully',
    timestamp: '2026-07-20T08:30:00Z',
    user: 'Viet Tran',
  },
  {
    id: 'a2',
    type: 'process',
    description: 'AI processing completed for zone-b-inspection.mp4',
    timestamp: '2026-07-20T07:15:00Z',
    user: 'System',
  },
  {
    id: 'a3',
    type: 'review',
    description: '124 dataset images marked for review',
    timestamp: '2026-07-19T16:40:00Z',
    user: 'Viet Tran',
  },
  {
    id: 'a4',
    type: 'export',
    description: 'Dataset exported: training_set_v3.zip (2,340 images)',
    timestamp: '2026-07-19T14:00:00Z',
    user: 'Viet Tran',
  },
  {
    id: 'a5',
    type: 'upload',
    description: 'inventory-check-north.mp4 upload started',
    timestamp: '2026-07-19T10:10:00Z',
    user: 'System',
  },
  {
    id: 'a6',
    type: 'train',
    description: 'YOLO model training session initiated',
    timestamp: '2026-07-18T09:00:00Z',
    user: 'Viet Tran',
  },
]

export const mockDashboardStats: DashboardStats = {
  uploadedVideos: 47,
  processingVideos: 3,
  needReview: 12,
  totalDataset: 8420,
  aiModels: 2,
  storageUsed: '128 GB',
  storageTotal: '500 GB',
  storagePercent: 26,
}

export const mockDatasetImages: DatasetImage[] = [
  {
    id: 'img1',
    name: 'frame_001234.jpg',
    preview: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=80&h=60&fit=crop',
    sourceVideo: 'warehouse-scan-2024-01-15.mp4',
    status: 'Training',
    createdDate: '2026-07-20T08:35:00Z',
  },
  {
    id: 'img2',
    name: 'frame_005678.jpg',
    preview: 'https://images.unsplash.com/photo-1553413077-190dd305871c?w=80&h=60&fit=crop',
    sourceVideo: 'zone-b-inspection.mp4',
    status: 'Validation',
    createdDate: '2026-07-19T14:30:00Z',
  },
  {
    id: 'img3',
    name: 'frame_009012.jpg',
    preview: 'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=80&h=60&fit=crop',
    sourceVideo: 'zone-b-inspection.mp4',
    status: 'Training',
    createdDate: '2026-07-19T14:31:00Z',
  },
  {
    id: 'img4',
    name: 'frame_013456.jpg',
    preview: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=80&h=60&fit=crop',
    sourceVideo: 'quality-control-batch-7.mp4',
    status: 'Pending',
    createdDate: '2026-07-18T13:45:00Z',
  },
  {
    id: 'img5',
    name: 'frame_017890.jpg',
    preview: 'https://images.unsplash.com/photo-1580828343064-fde4fc206bc6?w=80&h=60&fit=crop',
    sourceVideo: 'aisle-3-evening-scan.mp4',
    status: 'Training',
    createdDate: '2026-07-17T19:00:00Z',
  },
  {
    id: 'img6',
    name: 'frame_022134.jpg',
    preview: 'https://images.unsplash.com/photo-1565793979827-a5f5b67bc9f7?w=80&h=60&fit=crop',
    sourceVideo: 'shelf-restock-morning.mp4',
    status: 'Validation',
    createdDate: '2026-07-18T08:00:00Z',
  },
  {
    id: 'img7',
    name: 'frame_026578.jpg',
    preview: 'https://images.unsplash.com/photo-1605296867304-46d5465a13f1?w=80&h=60&fit=crop',
    sourceVideo: 'loading-dock-cam-02.mp4',
    status: 'Pending',
    createdDate: '2026-07-17T16:30:00Z',
  },
  {
    id: 'img8',
    name: 'frame_030012.jpg',
    preview: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=80&h=60&fit=crop',
    sourceVideo: 'warehouse-scan-2024-01-15.mp4',
    status: 'Training',
    createdDate: '2026-07-20T08:36:00Z',
  },
]

export const mockDatasetStats: DatasetStats = {
  totalImages: 8420,
  trainingImages: 6736,
  validationImages: 1684,
}

export const mockAIModels: AIModel[] = [
  {
    id: 'm1',
    name: 'YOLOv8 Object Detection',
    type: 'YOLO',
    description: 'Real-time object detection for product identification, tracking codes, and barcode scanning in warehouse environments.',
    status: 'Not Trained',
    version: 'v8.0',
    lastUpdated: '2026-07-01T00:00:00Z',
  },
  {
    id: 'm2',
    name: 'OCR Text Recognition',
    type: 'OCR',
    description: 'Optical character recognition for extracting text from packaging labels, SKU codes, and product information.',
    status: 'Not Trained',
    version: 'v2.1',
    lastUpdated: '2026-07-01T00:00:00Z',
  },
]

export const mockWarehouses: Warehouse[] = [
  { id: 'wh1', name: 'WH-Central', location: 'Ho Chi Minh City', createdAt: '2026-01-10T00:00:00Z' },
  { id: 'wh2', name: 'WH-North', location: 'Hanoi', createdAt: '2026-02-15T00:00:00Z' },
  { id: 'wh3', name: 'WH-South', location: 'Can Tho', createdAt: '2026-03-20T00:00:00Z' },
  { id: 'wh4', name: 'WH-East', location: 'Da Nang', createdAt: '2026-04-05T00:00:00Z' },
  { id: 'wh5', name: 'WH-West', location: 'Binh Duong', createdAt: '2026-05-12T00:00:00Z' },
]

export const mockBrands: Brand[] = [
  { id: 'b1', name: 'Nike', code: 'NK', createdAt: '2026-01-10T00:00:00Z' },
  { id: 'b2', name: 'Adidas', code: 'AD', createdAt: '2026-01-10T00:00:00Z' },
  { id: 'b3', name: 'Puma', code: 'PM', createdAt: '2026-02-01T00:00:00Z' },
  { id: 'b4', name: 'New Balance', code: 'NB', createdAt: '2026-02-15T00:00:00Z' },
  { id: 'b5', name: 'Under Armour', code: 'UA', createdAt: '2026-03-01T00:00:00Z' },
  { id: 'b6', name: 'Reebok', code: 'RB', createdAt: '2026-03-10T00:00:00Z' },
]

export const mockUser: UserProfile = {
  id: 'u1',
  name: 'Viet Tran',
  email: 'viet.tran@onpoint.vn',
  role: 'Administrator',
}

// ── Phase 2 Mock Data ────────────────────────────────────────────────────────

export const mockProcessingJobs: ProcessingJob[] = [
  {
    id: 'job1',
    videoId: 'v1',
    videoName: 'warehouse-scan-2024-01-15.mp4',
    status: 'completed',
    progress: 100,
    steps: {
      frameExtraction: { status: 'completed', progress: 100, message: '1,240 frames extracted' },
      ocr: { status: 'completed', progress: 100, message: '987 OCR results found' },
      tracking: { status: 'completed', progress: 100, message: '734 tracking codes matched' },
      packagingDetection: { status: 'completed', progress: 100, message: '1,102 packages detected' },
      productDetection: { status: 'completed', progress: 100, message: '856 products identified' },
      qualityDetection: { status: 'completed', progress: 100, message: 'Quality check passed' },
    },
    startTime: '2026-07-20T08:30:00Z',
    endTime: '2026-07-20T09:15:00Z',
    totalFrames: 1240,
    selectedFrames: 987,
    discardedFrames: 253,
    blurFrames: 89,
    duplicateFrames: 164,
  },
  {
    id: 'job2',
    videoId: 'v2',
    videoName: 'inventory-check-north.mp4',
    status: 'running',
    progress: 62,
    steps: {
      frameExtraction: { status: 'completed', progress: 100, message: '2,180 frames extracted' },
      ocr: { status: 'completed', progress: 100, message: '1,650 OCR results found' },
      tracking: { status: 'running', progress: 74, message: 'Matching tracking codes...' },
      packagingDetection: { status: 'pending', progress: 0, message: 'Waiting...' },
      productDetection: { status: 'pending', progress: 0, message: 'Waiting...' },
      qualityDetection: { status: 'pending', progress: 0, message: 'Waiting...' },
    },
    startTime: '2026-07-20T10:15:00Z',
    totalFrames: 2180,
    selectedFrames: 1650,
    discardedFrames: 530,
    blurFrames: 210,
    duplicateFrames: 320,
  },
  {
    id: 'job3',
    videoId: 'v7',
    videoName: 'loading-dock-cam-02.mp4',
    status: 'failed',
    progress: 38,
    steps: {
      frameExtraction: { status: 'completed', progress: 100, message: '2,800 frames extracted' },
      ocr: { status: 'failed', progress: 38, message: 'OCR engine error: timeout after 120s' },
      tracking: { status: 'skipped', progress: 0, message: 'Skipped due to OCR failure' },
      packagingDetection: { status: 'skipped', progress: 0, message: 'Skipped' },
      productDetection: { status: 'skipped', progress: 0, message: 'Skipped' },
      qualityDetection: { status: 'skipped', progress: 0, message: 'Skipped' },
    },
    startTime: '2026-07-19T16:00:00Z',
    endTime: '2026-07-19T16:22:00Z',
    totalFrames: 2800,
    selectedFrames: 0,
    discardedFrames: 0,
    blurFrames: 0,
    duplicateFrames: 0,
  },
  {
    id: 'job4',
    videoId: 'v3',
    videoName: 'zone-b-inspection.mp4',
    status: 'pending',
    progress: 0,
    steps: {
      frameExtraction: { status: 'pending', progress: 0, message: 'Queued' },
      ocr: { status: 'pending', progress: 0, message: 'Queued' },
      tracking: { status: 'pending', progress: 0, message: 'Queued' },
      packagingDetection: { status: 'pending', progress: 0, message: 'Queued' },
      productDetection: { status: 'pending', progress: 0, message: 'Queued' },
      qualityDetection: { status: 'pending', progress: 0, message: 'Queued' },
    },
    startTime: '2026-07-21T07:00:00Z',
    totalFrames: 0,
    selectedFrames: 0,
    discardedFrames: 0,
    blurFrames: 0,
    duplicateFrames: 0,
  },
]

const thumbUrls = [
  'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=320&h=180&fit=crop',
  'https://images.unsplash.com/photo-1553413077-190dd305871c?w=320&h=180&fit=crop',
  'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=320&h=180&fit=crop',
  'https://images.unsplash.com/photo-1542838132-92c53300491e?w=320&h=180&fit=crop',
  'https://images.unsplash.com/photo-1580828343064-fde4fc206bc6?w=320&h=180&fit=crop',
]

export const mockFrames: Frame[] = Array.from({ length: 20 }, (_, i) => ({
  id: `fr${i + 1}`,
  jobId: 'job1',
  videoId: 'v1',
  timestamp: `00:${String(Math.floor(i * 13 / 60)).padStart(2,'0')}:${String((i * 13) % 60).padStart(2,'0')}`,
  thumbnailUrl: thumbUrls[i % thumbUrls.length],
  blurScore: Math.round(10 + Math.random() * 85),
  ocrStatus: (['found', 'found', 'found', 'not_found', 'error'] as const)[i % 5],
  trackingFound: i % 3 !== 2,
  frameQuality: (['excellent', 'good', 'good', 'fair', 'poor'] as const)[i % 5],
  isDuplicate: i % 7 === 0,
  brightness: Math.round(80 + Math.random() * 120),
}))

const carriers = ['SPX', 'GHN', 'JNT', 'GHTK', 'NJVN', 'SPX', 'GHN', 'JNT', 'GHTK', 'SPX'] as const
const trackCodes = [
  'SPXVN02345678', 'GHN12345678', 'JNT0009876543', 'GHTK87654321', 'NJV012345678',
  'SPXVN08765432', 'GHN98765432', 'JNT0001234567', 'GHTK12341234', 'SPXVN05556677',
]

export const mockOCRResults: OCRResult[] = Array.from({ length: 10 }, (_, i) => ({
  id: `ocr${i + 1}`,
  frameId: `fr${i + 1}`,
  detectedText: `${carriers[i]}: ${trackCodes[i]}\nShipper: WH-Central\nWeight: ${(1 + i * 0.3).toFixed(1)} kg`,
  confidence: Math.round(72 + Math.random() * 27),
  language: 'vi',
  status: (['verified', 'verified', 'pending', 'verified', 'failed', 'verified', 'pending', 'verified', 'pending', 'verified'] as const)[i],
  carrier: carriers[i],
  trackingCode: trackCodes[i],
}))

export const mockAnnotations: Annotation[] = Array.from({ length: 10 }, (_, i) => ({
  id: `ann${i + 1}`,
  frameId: `fr${i + 1}`,
  reviewer: ['Viet Tran', 'Minh Nguyen', 'Lan Pham', 'System'][i % 4],
  status: (['pending', 'approved', 'approved', 'rejected', 'pending', 'approved', 'pending', 'rejected', 'approved', 'pending'] as const)[i],
  confidence: Math.round(65 + Math.random() * 34),
  boundingBoxes: [
    { id: `bb${i}a`, label: 'Tracking Label', x: 120 + i * 5, y: 80 + i * 3, width: 200, height: 40, confidence: 0.92 },
    { id: `bb${i}b`, label: 'Barcode', x: 300 + i * 3, y: 200 + i * 2, width: 80, height: 80, confidence: 0.88 },
    { id: `bb${i}c`, label: 'Packaging', x: 50 + i * 4, y: 30 + i, width: 500, height: 350, confidence: 0.95 },
  ],
  createdAt: `2026-07-${String(19 + Math.floor(i / 5)).padStart(2,'0')}T${String(8 + i).padStart(2,'0')}:00:00Z`,
  updatedAt: `2026-07-${String(19 + Math.floor(i / 5)).padStart(2,'0')}T${String(9 + i).padStart(2,'0')}:30:00Z`,
}))

export const mockAnnotationReviews: AnnotationReview[] = Array.from({ length: 5 }, (_, i) => ({
  id: `rev${i + 1}`,
  annotationId: `ann${i + 2}`,
  reviewer: ['Minh Nguyen', 'Lan Pham', 'Viet Tran', 'Minh Nguyen', 'Lan Pham'][i],
  reviewTime: `2026-07-${String(19 + i).padStart(2,'0')}T14:${String(i * 10).padStart(2,'0')}:00Z`,
  approvalStatus: (['approved', 'approved', 'rejected', 'approved', 'rejected'] as const)[i],
  comments: [
    'Bounding boxes look accurate.',
    'OCR text verified against physical label.',
    'Blur too high — please retake.',
    'All labels correct.',
    'Packaging boundary slightly off.',
  ][i],
  confidence: [91, 88, 45, 93, 67][i],
}))

export const mockFeatures: Feature[] = Array.from({ length: 20 }, (_, i) => ({
  id: `feat${i + 1}`,
  frameId: `fr${i + 1}`,
  trackingFound: i % 3 !== 2,
  barcodeFound: i % 4 !== 3,
  packagingType: ['Box', 'Bag', 'Envelope', 'Tube', 'Box'][i % 5],
  ocrConfidence: Math.round(60 + Math.random() * 39),
  blurScore: Math.round(10 + Math.random() * 85),
  brightness: (['normal', 'normal', 'dark', 'bright', 'normal'] as const)[i % 5],
  frameQuality: (['excellent', 'good', 'good', 'fair', 'poor'] as const)[i % 5],
  rotation: Math.round(Math.random() * 15) * (i % 2 === 0 ? 1 : -1),
  isDuplicate: i % 7 === 0,
}))

export const mockDatasetRecord: DatasetRecord = {
  id: 'ds1',
  name: 'Warehouse Training Set',
  version: 'v3',
  totalImages: 8420,
  trainingImages: 6736,
  validationImages: 1261,
  rejectedImages: 234,
  pendingReview: 189,
  createdAt: '2026-07-01T00:00:00Z',
}

export const mockDatasetVersions: DatasetVersion[] = [
  {
    id: 'dv1',
    datasetId: 'ds1',
    version: 'v1',
    format: 'YOLO',
    exportedAt: '2026-06-01T10:00:00Z',
    status: 'ready',
    changelog: 'Initial dataset with 2,800 images. Only packaging detection labels.',
  },
  {
    id: 'dv2',
    datasetId: 'ds1',
    version: 'v2',
    format: 'COCO',
    exportedAt: '2026-06-20T14:30:00Z',
    status: 'ready',
    changelog: 'Added OCR and tracking code annotations. 5,100 total images. Fixed mislabeled packaging.',
  },
  {
    id: 'dv3',
    datasetId: 'ds1',
    version: 'v3',
    format: 'YOLO',
    exportedAt: '2026-07-19T09:00:00Z',
    status: 'ready',
    changelog: 'Full dataset v3: 8,420 images. Added product detection, quality detection, blur filtering. Improved annotations.',
  },
]

export const mockProcessingLogs: ProcessingLog[] = [
  { id: 'log1', jobId: 'job1', level: 'info', message: 'Job started for warehouse-scan-2024-01-15.mp4', timestamp: '2026-07-20T08:30:00Z' },
  { id: 'log2', jobId: 'job1', level: 'info', message: 'Frame extraction started. Target: 30fps → 5fps sampling', timestamp: '2026-07-20T08:30:05Z' },
  { id: 'log3', jobId: 'job1', level: 'info', message: 'Frame extraction complete: 1,240 frames in 45s', timestamp: '2026-07-20T08:30:50Z' },
  { id: 'log4', jobId: 'job1', level: 'warn', message: '89 frames flagged as blurry (score < 20)', timestamp: '2026-07-20T08:31:00Z' },
  { id: 'log5', jobId: 'job1', level: 'info', message: 'OCR engine initialized. Model: PaddleOCR-vi v2.6', timestamp: '2026-07-20T08:31:05Z' },
  { id: 'log6', jobId: 'job1', level: 'info', message: 'OCR processing: 987/1240 frames have readable text', timestamp: '2026-07-20T08:42:00Z' },
  { id: 'log7', jobId: 'job1', level: 'warn', message: '164 duplicate frames detected and removed', timestamp: '2026-07-20T08:43:00Z' },
  { id: 'log8', jobId: 'job1', level: 'info', message: 'Regex tracking code extraction: 734 codes matched (SPX, GHN, JNT, GHTK)', timestamp: '2026-07-20T08:50:00Z' },
  { id: 'log9', jobId: 'job1', level: 'info', message: 'Packaging detection complete: 1,102 instances', timestamp: '2026-07-20T09:00:00Z' },
  { id: 'log10', jobId: 'job1', level: 'info', message: 'Product detection complete: 856 products identified', timestamp: '2026-07-20T09:08:00Z' },
  { id: 'log11', jobId: 'job1', level: 'info', message: 'Quality detection complete. All checks passed', timestamp: '2026-07-20T09:14:00Z' },
  { id: 'log12', jobId: 'job1', level: 'info', message: 'Job completed successfully. Total duration: 44m 58s', timestamp: '2026-07-20T09:15:00Z' },
]

export const mockNotifications: Notification[] = [
  {
    id: 'n1',
    type: 'processing_complete',
    title: 'Processing Complete',
    message: 'warehouse-scan-2024-01-15.mp4 has finished processing. 987 frames ready for review.',
    read: false,
    createdAt: '2026-07-20T09:15:00Z',
  },
  {
    id: 'n2',
    type: 'ocr_failed',
    title: 'OCR Error',
    message: 'loading-dock-cam-02.mp4 OCR failed after timeout. Please retry or check file integrity.',
    read: false,
    createdAt: '2026-07-19T16:22:00Z',
  },
  {
    id: 'n3',
    type: 'frame_needs_review',
    title: 'Frames Need Review',
    message: '12 frames in inventory-check-north.mp4 have low confidence and need manual review.',
    read: false,
    createdAt: '2026-07-20T10:45:00Z',
  },
  {
    id: 'n4',
    type: 'dataset_exported',
    title: 'Dataset Exported',
    message: 'Warehouse Training Set v3 (YOLO format) exported successfully. 8,420 images.',
    read: true,
    createdAt: '2026-07-19T09:05:00Z',
  },
  {
    id: 'n5',
    type: 'processing_complete',
    title: 'Processing Complete',
    message: 'zone-b-inspection.mp4 is ready. 1,450 frames extracted.',
    read: true,
    createdAt: '2026-07-19T14:30:00Z',
  },
  {
    id: 'n6',
    type: 'frame_needs_review',
    title: 'New Annotation Queue',
    message: '34 new frames added to the annotation queue from zone-b-inspection.mp4.',
    read: true,
    createdAt: '2026-07-19T14:35:00Z',
  },
  {
    id: 'n7',
    type: 'ocr_failed',
    title: 'Low OCR Confidence',
    message: '23 frames have OCR confidence below 70%. Review recommended.',
    read: true,
    createdAt: '2026-07-18T11:00:00Z',
  },
  {
    id: 'n8',
    type: 'dataset_exported',
    title: 'Dataset Export Started',
    message: 'COCO format export of Dataset v2 started. You will be notified when complete.',
    read: true,
    createdAt: '2026-07-18T09:00:00Z',
  },
]

// ── Phase 3 Mock Data — AI Annotation Engine ─────────────────────────────────

export const mockAnnotationJobs: AnnotationJob[] = [
  {
    id: 'aj1',
    name: 'WH-Central Batch #12',
    frameCount: 450,
    pendingCount: 30,
    approvedCount: 280,
    rejectedCount: 40,
    autoApprovedCount: 320,
    needReviewCount: 100,
    createdAt: '2026-07-20T08:00:00Z',
    status: 'completed',
  },
  {
    id: 'aj2',
    name: 'WH-North Morning Run',
    frameCount: 320,
    pendingCount: 80,
    approvedCount: 190,
    rejectedCount: 25,
    autoApprovedCount: 215,
    needReviewCount: 105,
    createdAt: '2026-07-20T10:30:00Z',
    status: 'running',
  },
  {
    id: 'aj3',
    name: 'Zone-B Inspection Batch',
    frameCount: 280,
    pendingCount: 140,
    approvedCount: 100,
    rejectedCount: 20,
    autoApprovedCount: 120,
    needReviewCount: 140,
    createdAt: '2026-07-19T14:00:00Z',
    status: 'pending',
  },
]

export const mockAIAnnotationSuggestions: AIAnnotationSuggestion[] = [
  { id: 's1',  frameId: 'f1',  label: 'TrackingLabel', boundingBox: { x: 120, y: 80,  width: 200, height: 60  }, confidence: 96, reason: 'High-contrast text region with carrier-pattern font match', status: 'approved' },
  { id: 's2',  frameId: 'f1',  label: 'Barcode',       boundingBox: { x: 340, y: 85,  width: 80,  height: 55  }, confidence: 92, reason: 'Parallel line pattern detected matching EAN-13 format', status: 'approved' },
  { id: 's3',  frameId: 'f2',  label: 'QRCode',        boundingBox: { x: 50,  y: 120, width: 90,  height: 90  }, confidence: 88, reason: 'Square finder patterns present in three corners', status: 'pending' },
  { id: 's4',  frameId: 'f2',  label: 'OCRRegion',     boundingBox: { x: 160, y: 110, width: 250, height: 40  }, confidence: 74, reason: 'Text region with moderate legibility; blur may affect accuracy', status: 'pending' },
  { id: 's5',  frameId: 'f3',  label: 'Packaging',     boundingBox: { x: 30,  y: 50,  width: 400, height: 300 }, confidence: 91, reason: 'Rectangular box shape with brand color palette match', status: 'approved' },
  { id: 's6',  frameId: 'f3',  label: 'ProductRegion', boundingBox: { x: 60,  y: 80,  width: 150, height: 180 }, confidence: 83, reason: 'Object with product silhouette matching training classes', status: 'pending' },
  { id: 's7',  frameId: 'f4',  label: 'PossibleDamage',boundingBox: { x: 200, y: 150, width: 120, height: 80  }, confidence: 65, reason: 'Irregular texture and color deviation from intact packaging baseline', status: 'pending' },
  { id: 's8',  frameId: 'f4',  label: 'TrackingLabel', boundingBox: { x: 10,  y: 10,  width: 180, height: 55  }, confidence: 78, reason: 'Partial label visibility; tracking code partially occluded', status: 'pending' },
  { id: 's9',  frameId: 'f5',  label: 'Barcode',       boundingBox: { x: 300, y: 200, width: 90,  height: 60  }, confidence: 95, reason: 'Clear barcode with high signal-to-noise ratio', status: 'approved' },
  { id: 's10', frameId: 'f5',  label: 'OCRRegion',     boundingBox: { x: 100, y: 160, width: 180, height: 35  }, confidence: 89, reason: 'Clear printed text, high OCR confidence', status: 'approved' },
  { id: 's11', frameId: 'f6',  label: 'QRCode',        boundingBox: { x: 80,  y: 40,  width: 100, height: 100 }, confidence: 61, reason: 'QR pattern partially damaged; low module contrast', status: 'pending' },
  { id: 's12', frameId: 'f6',  label: 'Packaging',     boundingBox: { x: 20,  y: 10,  width: 380, height: 280 }, confidence: 87, reason: 'Packaging detected with known brand shape model', status: 'approved' },
  { id: 's13', frameId: 'f7',  label: 'TrackingLabel', boundingBox: { x: 140, y: 90,  width: 210, height: 58  }, confidence: 93, reason: 'SPX carrier label format matched with 93% template similarity', status: 'approved' },
  { id: 's14', frameId: 'f7',  label: 'PossibleDamage',boundingBox: { x: 280, y: 200, width: 100, height: 70  }, confidence: 55, reason: 'Slight discoloration detected; confidence low due to lighting variation', status: 'rejected' },
  { id: 's15', frameId: 'f8',  label: 'ProductRegion', boundingBox: { x: 70,  y: 60,  width: 200, height: 220 }, confidence: 79, reason: 'Product silhouette detected; secondary verification recommended', status: 'pending' },
  { id: 's16', frameId: 'f8',  label: 'Barcode',       boundingBox: { x: 280, y: 100, width: 85,  height: 58  }, confidence: 97, reason: 'Perfect barcode scan with error-correction data intact', status: 'approved' },
  { id: 's17', frameId: 'f9',  label: 'OCRRegion',     boundingBox: { x: 50,  y: 200, width: 300, height: 45  }, confidence: 68, reason: 'Handwritten text region; lower confidence than printed', status: 'pending' },
  { id: 's18', frameId: 'f9',  label: 'TrackingLabel', boundingBox: { x: 100, y: 70,  width: 195, height: 62  }, confidence: 90, reason: 'GHN carrier tracking format confirmed', status: 'approved' },
  { id: 's19', frameId: 'f10', label: 'Packaging',     boundingBox: { x: 15,  y: 15,  width: 410, height: 290 }, confidence: 84, reason: 'Outer carton packaging detected with known dimensions', status: 'pending' },
  { id: 's20', frameId: 'f10', label: 'QRCode',        boundingBox: { x: 340, y: 20,  width: 75,  height: 75  }, confidence: 99, reason: 'Perfect QR code with all three finder patterns intact', status: 'approved' },
  { id: 's21', frameId: 'f11', label: 'PossibleDamage',boundingBox: { x: 150, y: 100, width: 130, height: 90  }, confidence: 72, reason: 'Crushed corner detected by depth map analysis', status: 'pending' },
  { id: 's22', frameId: 'f11', label: 'TrackingLabel', boundingBox: { x: 20,  y: 20,  width: 185, height: 55  }, confidence: 94, reason: 'NJVN carrier label clearly visible with barcode correlation', status: 'approved' },
  { id: 's23', frameId: 'f12', label: 'Barcode',       boundingBox: { x: 250, y: 180, width: 88,  height: 56  }, confidence: 76, reason: 'Barcode partially obscured by tape; reconstruction attempted', status: 'pending' },
  { id: 's24', frameId: 'f12', label: 'OCRRegion',     boundingBox: { x: 80,  y: 130, width: 160, height: 38  }, confidence: 85, reason: 'Address block detected with structured field patterns', status: 'approved' },
  { id: 's25', frameId: 'f13', label: 'ProductRegion', boundingBox: { x: 40,  y: 40,  width: 220, height: 240 }, confidence: 70, reason: 'Product shape detected but occlusion reduces confidence', status: 'pending' },
  { id: 's26', frameId: 'f13', label: 'Packaging',     boundingBox: { x: 0,   y: 0,   width: 450, height: 320 }, confidence: 98, reason: 'Full packaging visible with all six faces detected', status: 'approved' },
  { id: 's27', frameId: 'f14', label: 'TrackingLabel', boundingBox: { x: 130, y: 75,  width: 200, height: 60  }, confidence: 59, reason: 'Label wrinkled; character recognition confidence reduced', status: 'rejected' },
  { id: 's28', frameId: 'f14', label: 'QRCode',        boundingBox: { x: 350, y: 60,  width: 80,  height: 80  }, confidence: 88, reason: 'QR version 3 detected; data payload decoded successfully', status: 'approved' },
  { id: 's29', frameId: 'f15', label: 'PossibleDamage',boundingBox: { x: 100, y: 180, width: 200, height: 110 }, confidence: 81, reason: 'Wet damage pattern identified by color shift analysis', status: 'pending' },
  { id: 's30', frameId: 'f15', label: 'Barcode',       boundingBox: { x: 30,  y: 50,  width: 92,  height: 62  }, confidence: 93, reason: 'Code 128 barcode fully decoded, checksum verified', status: 'approved' },
]

export const mockKnowledgeRules: KnowledgeRule[] = [
  { id: 'kr1', name: 'SPX Tracking Pattern',   target: 'TrackingCode', type: 'regex',          value: '^SPX\\d{12}$',          description: 'Validates SPX carrier tracking code format', active: true  },
  { id: 'kr2', name: 'GHN Tracking Pattern',   target: 'TrackingCode', type: 'regex',          value: '^GHN\\d{10}[A-Z]$',     description: 'Validates GHN carrier tracking code format', active: true  },
  { id: 'kr3', name: 'Min Barcode Confidence', target: 'Barcode',      type: 'min_confidence', value: '80',                    description: 'Reject barcodes with confidence below 80%',  active: true  },
  { id: 'kr4', name: 'Min Tracking Confidence',target: 'TrackingCode', type: 'min_confidence', value: '85',                    description: 'Require ≥85% confidence for tracking labels', active: true  },
  { id: 'kr5', name: 'Packaging Must Have Label',target:'Packaging',   type: 'must_contain',   value: 'TrackingLabel',         description: 'Every packaging region must contain a tracking label', active: true  },
  { id: 'kr6', name: 'Square Packaging Ratio', target: 'Packaging',    type: 'aspect_ratio',   value: '0.5-3.0',               description: 'Packaging aspect ratio must be between 0.5 and 3.0', active: false },
  { id: 'kr7', name: 'Product Must Contain',   target: 'Product',      type: 'must_contain',   value: 'Barcode',               description: 'Product regions must have an associated barcode', active: true  },
  { id: 'kr8', name: 'NJVN Tracking Pattern',  target: 'TrackingCode', type: 'regex',          value: '^NJVN\\d{14}$',         description: 'Validates NJVN carrier tracking code format', active: false },
]

export const mockDuplicateGroups: DuplicateGroup[] = [
  {
    id: 'dg1',
    frames: [
      { frameId: 'f1', thumbnailUrl: '', timestamp: '00:12:03', similarityScore: 100 },
      { frameId: 'f2', thumbnailUrl: '', timestamp: '00:12:04', similarityScore: 98  },
      { frameId: 'f3', thumbnailUrl: '', timestamp: '00:12:05', similarityScore: 97  },
    ],
    keepFrameId: 'f1',
    discardedCount: 2,
  },
  {
    id: 'dg2',
    frames: [
      { frameId: 'f7',  thumbnailUrl: '', timestamp: '00:24:10', similarityScore: 100 },
      { frameId: 'f8',  thumbnailUrl: '', timestamp: '00:24:11', similarityScore: 99  },
    ],
    keepFrameId: 'f7',
    discardedCount: 1,
  },
  {
    id: 'dg3',
    frames: [
      { frameId: 'f11', thumbnailUrl: '', timestamp: '00:38:22', similarityScore: 100 },
      { frameId: 'f12', thumbnailUrl: '', timestamp: '00:38:23', similarityScore: 96  },
      { frameId: 'f13', thumbnailUrl: '', timestamp: '00:38:24', similarityScore: 95  },
      { frameId: 'f14', thumbnailUrl: '', timestamp: '00:38:25', similarityScore: 94  },
    ],
    keepFrameId: 'f11',
    discardedCount: 3,
  },
  {
    id: 'dg4',
    frames: [
      { frameId: 'f5', thumbnailUrl: '', timestamp: '00:18:44', similarityScore: 100 },
      { frameId: 'f6', thumbnailUrl: '', timestamp: '00:18:45', similarityScore: 97  },
    ],
    keepFrameId: 'f5',
    discardedCount: 1,
  },
  {
    id: 'dg5',
    frames: [
      { frameId: 'f9',  thumbnailUrl: '', timestamp: '00:31:05', similarityScore: 100 },
      { frameId: 'f10', thumbnailUrl: '', timestamp: '00:31:06', similarityScore: 98  },
    ],
    keepFrameId: 'f9',
    discardedCount: 1,
  },
]

export const mockAnnotationHistory: AnnotationHistoryEntry[] = [
  { id: 'ah1',  annotationId: 's1',  frameId: 'f1',  action: 'created',    reviewer: 'AI',        previousValue: null,            newValue: { label: 'TrackingLabel', confidence: 96 }, timestamp: '2026-07-20T08:05:00Z' },
  { id: 'ah2',  annotationId: 's1',  frameId: 'f1',  action: 'approved',   reviewer: 'Viet Tran', previousValue: 'pending',        newValue: 'approved',                               timestamp: '2026-07-20T09:10:00Z' },
  { id: 'ah3',  annotationId: 's4',  frameId: 'f2',  action: 'created',    reviewer: 'AI',        previousValue: null,            newValue: { label: 'OCRRegion', confidence: 74 },    timestamp: '2026-07-20T08:06:00Z' },
  { id: 'ah4',  annotationId: 's4',  frameId: 'f2',  action: 'edited',     reviewer: 'Lan Nguyen',previousValue: { confidence: 74 },newValue: { confidence: 82 },                      timestamp: '2026-07-20T10:15:00Z' },
  { id: 'ah5',  annotationId: 's7',  frameId: 'f4',  action: 'created',    reviewer: 'AI',        previousValue: null,            newValue: { label: 'PossibleDamage', confidence: 65 },timestamp:'2026-07-20T08:07:00Z' },
  { id: 'ah6',  annotationId: 's7',  frameId: 'f4',  action: 'rejected',   reviewer: 'Minh Le',   previousValue: 'pending',        newValue: 'rejected',                               timestamp: '2026-07-20T11:30:00Z' },
  { id: 'ah7',  annotationId: 's14', frameId: 'f7',  action: 'created',    reviewer: 'AI',        previousValue: null,            newValue: { label: 'PossibleDamage', confidence: 55 },timestamp:'2026-07-19T14:10:00Z' },
  { id: 'ah8',  annotationId: 's14', frameId: 'f7',  action: 'rejected',   reviewer: 'Viet Tran', previousValue: 'pending',        newValue: 'rejected',                               timestamp: '2026-07-19T15:05:00Z' },
  { id: 'ah9',  annotationId: 's27', frameId: 'f14', action: 'created',    reviewer: 'AI',        previousValue: null,            newValue: { label: 'TrackingLabel', confidence: 59 },timestamp:'2026-07-19T13:00:00Z' },
  { id: 'ah10', annotationId: 's27', frameId: 'f14', action: 'rejected',   reviewer: 'Lan Nguyen',previousValue: 'pending',        newValue: 'rejected',                               timestamp: '2026-07-19T13:45:00Z' },
  { id: 'ah11', annotationId: 's11', frameId: 'f6',  action: 'created',    reviewer: 'AI',        previousValue: null,            newValue: { label: 'QRCode', confidence: 61 },       timestamp: '2026-07-20T08:08:00Z' },
  { id: 'ah12', annotationId: 's11', frameId: 'f6',  action: 'edited',     reviewer: 'Minh Le',   previousValue: { confidence: 61 },newValue: { confidence: 70 },                      timestamp: '2026-07-20T12:00:00Z' },
  { id: 'ah13', annotationId: 's11', frameId: 'f6',  action: 'approved',   reviewer: 'Viet Tran', previousValue: 'pending',        newValue: 'approved',                               timestamp: '2026-07-20T12:10:00Z' },
  { id: 'ah14', annotationId: 's21', frameId: 'f11', action: 'created',    reviewer: 'AI',        previousValue: null,            newValue: { label: 'PossibleDamage', confidence: 72 },timestamp:'2026-07-20T09:00:00Z' },
  { id: 'ah15', annotationId: 's21', frameId: 'f11', action: 'rolled_back',reviewer: 'Lan Nguyen',previousValue: 'rejected',      newValue: 'pending',                                timestamp: '2026-07-20T09:50:00Z' },
]

export const mockReviewSessions: ReviewSession[] = [
  { id: 'rs1', reviewer: 'Viet Tran',  startTime: '2026-07-20T08:00:00Z', endTime: '2026-07-20T09:30:00Z', framesReviewed: 48, approvals: 40, rejections: 6, edits: 2, avgReviewTimeMs: 5200 },
  { id: 'rs2', reviewer: 'Lan Nguyen', startTime: '2026-07-20T09:00:00Z', endTime: '2026-07-20T11:00:00Z', framesReviewed: 72, approvals: 55, rejections: 12, edits: 5, avgReviewTimeMs: 6800 },
  { id: 'rs3', reviewer: 'Minh Le',    startTime: '2026-07-19T13:00:00Z', endTime: '2026-07-19T15:30:00Z', framesReviewed: 60, approvals: 44, rejections: 10, edits: 6, avgReviewTimeMs: 7500 },
  { id: 'rs4', reviewer: 'Viet Tran',  startTime: '2026-07-19T08:30:00Z', endTime: '2026-07-19T10:00:00Z', framesReviewed: 50, approvals: 42, rejections: 5, edits: 3, avgReviewTimeMs: 4800 },
]

export const mockAnnotationAnalytics: AnnotationAnalytics = {
  totalFramesReviewed: 1840,
  approvalRate: 84.2,
  avgReviewTimeMs: 6075,
  aiAccuracy: 91.3,
  ocrAccuracy: 87.6,
  duplicateReduction: 12.4,
  reviewerPerformance: [
    { reviewer: 'Viet Tran',  framesReviewed: 580, approvalRate: 88.0, avgTimeMs: 5000 },
    { reviewer: 'Lan Nguyen', framesReviewed: 720, approvalRate: 82.5, avgTimeMs: 6900 },
    { reviewer: 'Minh Le',    framesReviewed: 540, approvalRate: 80.7, avgTimeMs: 7600 },
  ],
  dailyProgress: [
    { date: '2026-07-15', reviewed: 210, approved: 175, rejected: 35 },
    { date: '2026-07-16', reviewed: 280, approved: 240, rejected: 40 },
    { date: '2026-07-17', reviewed: 245, approved: 200, rejected: 45 },
    { date: '2026-07-18', reviewed: 310, approved: 265, rejected: 45 },
    { date: '2026-07-19', reviewed: 290, approved: 248, rejected: 42 },
    { date: '2026-07-20', reviewed: 320, approved: 270, rejected: 50 },
    { date: '2026-07-21', reviewed: 185, approved: 152, rejected: 33 },
  ],
}

export const mockDatasetQualityScore: DatasetQualityScore = {
  datasetId: 'ds1',
  totalImages: 8420,
  blurPercent: 3.2,
  duplicatesPercent: 1.8,
  ocrQuality: 87.6,
  annotationConsistency: 92.4,
  overallScore: 91.2,
}

export const mockActiveLearningFrames: ActiveLearningFrame[] = [
  { frameId: 'f4',  thumbnailUrl: '', reason: 'high_blur',        priority: 'high',   blurScore: 18,  ocrConfidence: 45 },
  { frameId: 'f11', thumbnailUrl: '', reason: 'unknown_damage',   priority: 'high',   blurScore: 72,  ocrConfidence: 80 },
  { frameId: 'f17', thumbnailUrl: '', reason: 'low_ocr',          priority: 'high',   blurScore: 65,  ocrConfidence: 38 },
  { frameId: 'f6',  thumbnailUrl: '', reason: 'unknown_packaging', priority: 'medium', blurScore: 80,  ocrConfidence: 72 },
  { frameId: 'f9',  thumbnailUrl: '', reason: 'unknown_product',  priority: 'medium', blurScore: 78,  ocrConfidence: 68 },
  { frameId: 'f22', thumbnailUrl: '', reason: 'high_blur',        priority: 'medium', blurScore: 25,  ocrConfidence: 55 },
  { frameId: 'f25', thumbnailUrl: '', reason: 'low_ocr',          priority: 'medium', blurScore: 70,  ocrConfidence: 42 },
  { frameId: 'f14', thumbnailUrl: '', reason: 'unknown_packaging', priority: 'low',   blurScore: 85,  ocrConfidence: 76 },
  { frameId: 'f28', thumbnailUrl: '', reason: 'unknown_product',  priority: 'low',    blurScore: 88,  ocrConfidence: 81 },
  { frameId: 'f31', thumbnailUrl: '', reason: 'unknown_damage',   priority: 'low',    blurScore: 90,  ocrConfidence: 85 },
]

// ── Phase 4 Mock Data — AI Training Center ────────────────────────────────────

export const mockTrainingTemplates: TrainingTemplate[] = [
  {
    id: 'tpl-1',
    name: 'YOLOv11',
    framework: 'PyTorch',
    description: 'State-of-the-art real-time object detection with improved accuracy and speed over previous YOLO versions.',
    supportedTasks: ['Object Detection', 'Instance Segmentation', 'Pose Estimation'],
    defaultHyperparams: {
      epochs: 100, batchSize: 16, imageSize: 640, learningRate: 0.01,
      optimizer: 'AdamW', scheduler: 'cosine', earlyStoppingPatience: 10,
      workers: 8, randomSeed: 42, mixedPrecision: true, resumeTraining: false, autoSave: true,
    },
  },
  {
    id: 'tpl-2',
    name: 'RT-DETR',
    framework: 'PyTorch',
    description: 'Real-Time Detection Transformer — end-to-end detection without NMS, excellent accuracy.',
    supportedTasks: ['Object Detection', 'Classification'],
    defaultHyperparams: {
      epochs: 72, batchSize: 8, imageSize: 640, learningRate: 0.0001,
      optimizer: 'AdamW', scheduler: 'cosine', earlyStoppingPatience: 15,
      workers: 4, randomSeed: 0, mixedPrecision: true, resumeTraining: false, autoSave: true,
    },
  },
  {
    id: 'tpl-3',
    name: 'PaddleOCR',
    framework: 'PaddlePaddle',
    description: 'Industrial-grade OCR system supporting 80+ languages with scene text recognition.',
    supportedTasks: ['OCR', 'Text Detection', 'Text Recognition'],
    defaultHyperparams: {
      epochs: 200, batchSize: 32, imageSize: 320, learningRate: 0.001,
      optimizer: 'Adam', scheduler: 'cosine', earlyStoppingPatience: 20,
      workers: 8, randomSeed: 42, mixedPrecision: false, resumeTraining: true, autoSave: true,
    },
  },
  {
    id: 'tpl-4',
    name: 'Florence-2',
    framework: 'PyTorch',
    description: 'Microsoft vision foundation model for captioning, detection, grounding, and segmentation.',
    supportedTasks: ['Object Detection', 'Captioning', 'Grounding', 'Segmentation'],
    defaultHyperparams: {
      epochs: 50, batchSize: 4, imageSize: 768, learningRate: 0.00005,
      optimizer: 'AdamW', scheduler: 'linear', earlyStoppingPatience: 8,
      workers: 4, randomSeed: 42, mixedPrecision: true, resumeTraining: false, autoSave: true,
    },
  },
  {
    id: 'tpl-5',
    name: 'Custom PyTorch',
    framework: 'PyTorch',
    description: 'Bring your own model architecture. Fully configurable training pipeline.',
    supportedTasks: ['Object Detection', 'Classification', 'Segmentation', 'OCR', 'Custom'],
    defaultHyperparams: {
      epochs: 100, batchSize: 16, imageSize: 640, learningRate: 0.001,
      optimizer: 'SGD', scheduler: 'step', earlyStoppingPatience: 10,
      workers: 4, randomSeed: 0, mixedPrecision: false, resumeTraining: false, autoSave: true,
    },
  },
]

export const mockGPUNodes: GPUNode[] = [
  { id: 'gpu-1', name: 'RTX 3060', memoryTotal: 12, memoryUsed: 8.4, temperature: 72, power: 170, utilization: 87, status: 'busy' },
  { id: 'gpu-2', name: 'RTX 4090', memoryTotal: 24, memoryUsed: 6.2, temperature: 58, power: 220, utilization: 42, status: 'busy' },
  { id: 'gpu-3', name: 'A100', memoryTotal: 80, memoryUsed: 12.0, temperature: 45, power: 180, utilization: 21, status: 'available' },
  { id: 'cpu-1', name: 'CPU (64-core)', memoryTotal: 128, memoryUsed: 32.0, temperature: 38, power: 280, utilization: 35, status: 'available' },
]

const makeLogs = (jobId: string, count = 15) =>
  Array.from({ length: count }, (_, i) => ({
    id: `log-${jobId}-${i}`,
    jobId,
    epoch: i < 5 ? undefined : i - 4,
    level: i === 7 ? 'warn' : i === 12 ? 'error' : 'info' as 'info' | 'warn' | 'error',
    message: i === 0
      ? 'Initializing training environment...'
      : i === 1
      ? 'Loading dataset: dataset-v2 (8420 images)'
      : i === 2
      ? 'Building model: YOLOv11 (83.2M params)'
      : i === 3
      ? 'Allocating GPU memory: 8.4 GB / 12 GB'
      : i === 4
      ? 'Starting training loop...'
      : i === 7
      ? 'Learning rate scheduler: cosine annealing active'
      : i === 12
      ? 'Checkpoint saved: best_model.pt (mAP50=0.823)'
      : `Epoch ${i - 4}/10 — train_loss: ${(0.85 - i * 0.04).toFixed(3)}, val_loss: ${(0.92 - i * 0.05).toFixed(3)}, mAP50: ${(0.65 + i * 0.018).toFixed(3)}`,
    timestamp: new Date(Date.now() - (count - i) * 60000).toISOString(),
  }))

export const mockTrainingJobs: TrainingJob[] = [
  {
    id: 'job-1', name: 'YOLOv11 Object Detection v3',
    modelTemplate: 'YOLOv11', datasetVersion: 'v2', datasetId: 'ds-1',
    status: 'training', progress: 64, currentEpoch: 64, totalEpochs: 100, eta: '1h 22m',
    gpuId: 'gpu-1', trainLoss: 0.312, valLoss: 0.348, accuracy: 87.4, mAP50: 0.823,
    mAP5095: 0.612, recall: 0.841, precision: 0.878, gpuUsage: 87, ramUsage: 62, diskUsage: 38,
    startTime: '2026-07-21T06:00:00Z', createdBy: 'viet.tran',
    logs: makeLogs('job-1'),
  },
  {
    id: 'job-2', name: 'PaddleOCR Tracking Label v1',
    modelTemplate: 'PaddleOCR', datasetVersion: 'v1', datasetId: 'ds-2',
    status: 'queued', progress: 0, currentEpoch: 0, totalEpochs: 200, eta: '—',
    gpuId: 'gpu-3', trainLoss: 0, valLoss: 0, accuracy: 0, mAP50: 0,
    mAP5095: 0, recall: 0, precision: 0, gpuUsage: 0, ramUsage: 0, diskUsage: 0,
    startTime: '', createdBy: 'viet.tran',
    logs: makeLogs('job-2', 3),
  },
  {
    id: 'job-3', name: 'RT-DETR Product Detection v2',
    modelTemplate: 'RT-DETR', datasetVersion: 'v2', datasetId: 'ds-1',
    status: 'completed', progress: 100, currentEpoch: 72, totalEpochs: 72, eta: 'Done',
    gpuId: 'gpu-2', trainLoss: 0.218, valLoss: 0.265, accuracy: 91.2, mAP50: 0.897,
    mAP5095: 0.681, recall: 0.904, precision: 0.912, gpuUsage: 0, ramUsage: 0, diskUsage: 52,
    startTime: '2026-07-20T10:00:00Z', endTime: '2026-07-20T18:30:00Z', createdBy: 'admin',
    logs: makeLogs('job-3'),
  },
  {
    id: 'job-4', name: 'Florence-2 Captioning Experiment',
    modelTemplate: 'Florence-2', datasetVersion: 'v1', datasetId: 'ds-2',
    status: 'failed', progress: 23, currentEpoch: 12, totalEpochs: 50, eta: 'Failed',
    gpuId: 'gpu-1', trainLoss: 1.42, valLoss: 1.88, accuracy: 34.1, mAP50: 0.312,
    mAP5095: 0.198, recall: 0.421, precision: 0.388, gpuUsage: 0, ramUsage: 0, diskUsage: 12,
    startTime: '2026-07-19T14:00:00Z', endTime: '2026-07-19T16:20:00Z', createdBy: 'viet.tran',
    logs: [
      ...makeLogs('job-4', 12),
      { id: 'log-job-4-err', jobId: 'job-4', epoch: 12, level: 'error', message: 'CUDA out of memory. Tried to allocate 2.0 GiB. GPU memory: 11.8/12.0 GiB allocated.', timestamp: new Date().toISOString() },
    ],
  },
]

export const mockExperiments: Experiment[] = [
  {
    id: 'exp-1', name: 'YOLOv11 Baseline', datasetVersion: 'v2', modelTemplate: 'YOLOv11',
    epochs: 100, learningRate: 0.01, batchSize: 16, finalMaP50: 0.823, finalAccuracy: 87.4,
    finalRecall: 0.841, finalPrecision: 0.878, f1Score: 0.859, trainingTime: '4h 18m',
    inferenceSpeed: 12.4, modelSizeMB: 42.2, createdBy: 'viet.tran', createdAt: '2026-07-21T10:00:00Z',
    jobId: 'job-1', status: 'completed',
  },
  {
    id: 'exp-2', name: 'RT-DETR Product v2', datasetVersion: 'v2', modelTemplate: 'RT-DETR',
    epochs: 72, learningRate: 0.0001, batchSize: 8, finalMaP50: 0.897, finalAccuracy: 91.2,
    finalRecall: 0.904, finalPrecision: 0.912, f1Score: 0.908, trainingTime: '8h 30m',
    inferenceSpeed: 18.6, modelSizeMB: 128.4, createdBy: 'admin', createdAt: '2026-07-20T18:30:00Z',
    jobId: 'job-3', status: 'completed',
  },
  {
    id: 'exp-3', name: 'YOLOv11 High LR', datasetVersion: 'v2', modelTemplate: 'YOLOv11',
    epochs: 80, learningRate: 0.05, batchSize: 32, finalMaP50: 0.741, finalAccuracy: 81.2,
    finalRecall: 0.762, finalPrecision: 0.798, f1Score: 0.780, trainingTime: '3h 05m',
    inferenceSpeed: 12.1, modelSizeMB: 42.2, createdBy: 'viet.tran', createdAt: '2026-07-19T12:00:00Z',
    jobId: 'job-1', status: 'completed',
  },
  {
    id: 'exp-4', name: 'PaddleOCR v1', datasetVersion: 'v1', modelTemplate: 'PaddleOCR',
    epochs: 150, learningRate: 0.001, batchSize: 32, finalMaP50: 0.912, finalAccuracy: 93.5,
    finalRecall: 0.921, finalPrecision: 0.934, f1Score: 0.927, trainingTime: '6h 40m',
    inferenceSpeed: 8.2, modelSizeMB: 18.6, createdBy: 'viet.tran', createdAt: '2026-07-18T09:00:00Z',
    jobId: 'job-2', status: 'completed',
  },
  {
    id: 'exp-5', name: 'Florence-2 Grounding', datasetVersion: 'v1', modelTemplate: 'Florence-2',
    epochs: 12, learningRate: 0.00005, batchSize: 4, finalMaP50: 0.312, finalAccuracy: 34.1,
    finalRecall: 0.421, finalPrecision: 0.388, f1Score: 0.404, trainingTime: '2h 20m',
    inferenceSpeed: 45.2, modelSizeMB: 512.0, createdBy: 'viet.tran', createdAt: '2026-07-19T16:20:00Z',
    jobId: 'job-4', status: 'failed',
  },
  {
    id: 'exp-6', name: 'RT-DETR Small Batch', datasetVersion: 'v2', modelTemplate: 'RT-DETR',
    epochs: 72, learningRate: 0.0001, batchSize: 4, finalMaP50: 0.881, finalAccuracy: 89.8,
    finalRecall: 0.887, finalPrecision: 0.895, f1Score: 0.891, trainingTime: '10h 15m',
    inferenceSpeed: 19.1, modelSizeMB: 128.4, createdBy: 'admin', createdAt: '2026-07-17T14:00:00Z',
    jobId: 'job-3', status: 'completed',
  },
]

const genMetrics = (baseMAP: number, baseLoss: number): MetricPoint[] =>
  Array.from({ length: 20 }, (_, i) => ({
    epoch: i + 1,
    trainLoss: parseFloat((baseLoss - i * 0.025 + Math.random() * 0.01).toFixed(3)),
    valLoss: parseFloat((baseLoss + 0.08 - i * 0.022 + Math.random() * 0.012).toFixed(3)),
    precision: parseFloat((0.6 + i * 0.016 + Math.random() * 0.005).toFixed(3)),
    recall: parseFloat((0.58 + i * 0.017 + Math.random() * 0.005).toFixed(3)),
    mAP50: parseFloat((baseMAP - 0.18 + i * 0.01 + Math.random() * 0.004).toFixed(3)),
    mAP5095: parseFloat((baseMAP - 0.38 + i * 0.008 + Math.random() * 0.003).toFixed(3)),
  }))

export const mockMetricHistory: Record<string, MetricPoint[]> = {
  'exp-1': genMetrics(0.823, 0.85),
  'exp-2': genMetrics(0.897, 0.72),
}

export const mockModelRegistry: ModelRegistryEntry[] = [
  {
    id: 'reg-1', name: 'Warehouse Object Detector', task: 'Object Detection',
    latestVersion: 'v2.0', owner: 'viet.tran', createdAt: '2026-07-15T00:00:00Z',
    description: 'Detects packages, pallets, and products in warehouse environments.',
    versions: [
      {
        id: 'mv-1', modelId: 'reg-1', version: 'v1.0', framework: 'PyTorch',
        datasetVersion: 'v1', accuracy: 81.2, mAP50: 0.741, inferenceSpeedMs: 14.2, modelSizeMB: 42.2,
        status: 'archived', deploymentStatus: 'not_deployed',
        createdAt: '2026-07-10T00:00:00Z', createdBy: 'viet.tran',
        description: 'Initial release trained on v1 dataset.',
        artifacts: ['best.pt', 'model.onnx'], experimentId: 'exp-3',
      },
      {
        id: 'mv-2', modelId: 'reg-1', version: 'v2.0', framework: 'PyTorch',
        datasetVersion: 'v2', accuracy: 87.4, mAP50: 0.823, inferenceSpeedMs: 12.4, modelSizeMB: 42.2,
        status: 'active', deploymentStatus: 'deployed',
        createdAt: '2026-07-21T00:00:00Z', createdBy: 'viet.tran',
        description: 'Improved with augmented v2 dataset. Better small object detection.',
        artifacts: ['best.pt', 'model.onnx', 'model.engine'], experimentId: 'exp-1',
      },
    ],
  },
  {
    id: 'reg-2', name: 'Tracking Label OCR', task: 'OCR',
    latestVersion: 'v1.2', owner: 'viet.tran', createdAt: '2026-07-12T00:00:00Z',
    description: 'OCR model specialized for logistics tracking label text recognition.',
    versions: [
      {
        id: 'mv-3', modelId: 'reg-2', version: 'v1.0', framework: 'PaddlePaddle',
        datasetVersion: 'v1', accuracy: 89.2, mAP50: 0.881, inferenceSpeedMs: 9.1, modelSizeMB: 18.6,
        status: 'archived', deploymentStatus: 'not_deployed',
        createdAt: '2026-07-12T00:00:00Z', createdBy: 'viet.tran',
        description: 'Initial OCR model.', artifacts: ['model.pdparams', 'model.onnx'], experimentId: 'exp-4',
      },
      {
        id: 'mv-4', modelId: 'reg-2', version: 'v1.1', framework: 'PaddlePaddle',
        datasetVersion: 'v1', accuracy: 91.8, mAP50: 0.904, inferenceSpeedMs: 8.4, modelSizeMB: 18.6,
        status: 'archived', deploymentStatus: 'not_deployed',
        createdAt: '2026-07-16T00:00:00Z', createdBy: 'viet.tran',
        description: 'Fine-tuned on carrier label dataset.', artifacts: ['model.pdparams', 'model.onnx'], experimentId: 'exp-4',
      },
      {
        id: 'mv-5', modelId: 'reg-2', version: 'v1.2', framework: 'PaddlePaddle',
        datasetVersion: 'v2', accuracy: 93.5, mAP50: 0.912, inferenceSpeedMs: 8.2, modelSizeMB: 18.6,
        status: 'active', deploymentStatus: 'deployed',
        createdAt: '2026-07-18T00:00:00Z', createdBy: 'viet.tran',
        description: 'Best performing OCR with multi-carrier support.', artifacts: ['model.pdparams', 'model.onnx', 'model.engine'], experimentId: 'exp-4',
      },
    ],
  },
  {
    id: 'reg-3', name: 'RT-DETR Product Detector', task: 'Object Detection',
    latestVersion: 'v1.0', owner: 'admin', createdAt: '2026-07-20T00:00:00Z',
    description: 'High-accuracy product detection using RT-DETR transformer architecture.',
    versions: [
      {
        id: 'mv-6', modelId: 'reg-3', version: 'v1.0', framework: 'PyTorch',
        datasetVersion: 'v2', accuracy: 91.2, mAP50: 0.897, inferenceSpeedMs: 18.6, modelSizeMB: 128.4,
        status: 'active', deploymentStatus: 'deploying',
        createdAt: '2026-07-20T18:30:00Z', createdBy: 'admin',
        description: 'Production candidate from RT-DETR experiment.', artifacts: ['best.pt', 'model.onnx'], experimentId: 'exp-2',
      },
    ],
  },
]

export const mockDeployments: Deployment[] = [
  {
    id: 'dep-1', modelId: 'reg-1', modelVersion: 'v2.0', modelName: 'Warehouse Object Detector',
    environment: 'production', format: 'tensorrt', status: 'running',
    endpoint: 'https://api.reverseai.vn/v1/detect/warehouse',
    deployedAt: '2026-07-20T12:00:00Z', deployedBy: 'viet.tran',
    replicas: 3, cpuUsage: 34, memoryUsage: 58,
  },
  {
    id: 'dep-2', modelId: 'reg-2', modelVersion: 'v1.2', modelName: 'Tracking Label OCR',
    environment: 'production', format: 'onnx', status: 'running',
    endpoint: 'https://api.reverseai.vn/v1/ocr/tracking',
    deployedAt: '2026-07-19T08:00:00Z', deployedBy: 'viet.tran',
    replicas: 2, cpuUsage: 22, memoryUsage: 31,
  },
  {
    id: 'dep-3', modelId: 'reg-3', modelVersion: 'v1.0', modelName: 'RT-DETR Product Detector',
    environment: 'testing', format: 'docker', status: 'deploying',
    endpoint: 'https://staging.reverseai.vn/v1/detect/product',
    deployedAt: '2026-07-21T09:00:00Z', deployedBy: 'admin',
    replicas: 1, cpuUsage: 0, memoryUsage: 0,
  },
  {
    id: 'dep-4', modelId: 'reg-1', modelVersion: 'v1.0', modelName: 'Warehouse Object Detector',
    environment: 'development', format: 'pytorch', status: 'stopped',
    deployedAt: '2026-07-15T10:00:00Z', deployedBy: 'viet.tran',
    replicas: 1, cpuUsage: 0, memoryUsage: 0,
  },
]

export const mockEvaluationReports: EvaluationReport[] = [
  {
    id: 'eval-1', modelId: 'reg-1', modelVersion: 'v2.0', datasetVersion: 'v2',
    precision: 0.878, recall: 0.841, f1: 0.859, mAP50: 0.823, mAP5095: 0.612,
    totalImages: 1684, falsePositives: 142, falseNegatives: 189, iou: 0.741,
    inferenceSpeedMs: 12.4, createdAt: '2026-07-21T08:00:00Z',
  },
  {
    id: 'eval-2', modelId: 'reg-2', modelVersion: 'v1.2', datasetVersion: 'v2',
    precision: 0.934, recall: 0.921, f1: 0.927, mAP50: 0.912, mAP5095: 0.0,
    totalImages: 840, falsePositives: 38, falseNegatives: 49, iou: 0.0,
    inferenceSpeedMs: 8.2, createdAt: '2026-07-20T14:00:00Z',
  },
  {
    id: 'eval-3', modelId: 'reg-3', modelVersion: 'v1.0', datasetVersion: 'v2',
    precision: 0.912, recall: 0.904, f1: 0.908, mAP50: 0.897, mAP5095: 0.681,
    totalImages: 1684, falsePositives: 104, falseNegatives: 113, iou: 0.821,
    inferenceSpeedMs: 18.6, createdAt: '2026-07-20T19:00:00Z',
  },
]

export const mockBenchmark: BenchmarkResult = {
  id: 'bench-1', datasetVersion: 'v2', winner: 'RT-DETR', createdAt: '2026-07-21T07:00:00Z',
  models: [
    { modelTemplate: 'YOLOv11',        accuracy: 87.4, speedMs: 12.4, memoryMB: 42.2,  gpuUsage: 68, powerW: 145, overallScore: 82.1 },
    { modelTemplate: 'RT-DETR',        accuracy: 91.2, speedMs: 18.6, memoryMB: 128.4, gpuUsage: 74, powerW: 198, overallScore: 88.4 },
    { modelTemplate: 'Grounding DINO', accuracy: 88.6, speedMs: 32.1, memoryMB: 256.0, gpuUsage: 81, powerW: 224, overallScore: 79.3 },
  ],
}
