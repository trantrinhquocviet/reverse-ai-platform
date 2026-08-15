export type VideoStatus = 'Uploaded' | 'Processing' | 'Ready' | 'Failed'

export interface VideoAudit {
  case_status: 'PASS' | 'PASS_WITH_WARNING' | 'WH_PROCESS_FAIL' | 'HUMAN_REVIEW_REQUIRED'
  video_evidence_score: number
  wh_errors: Array<{ error_code: string; severity: string; source: string; description: string; confidence: number }>
  event_audit: Record<string, string>
  quality_components: Record<string, number>
  frame_count: number
  finalized_at: string
}

export interface Video {
  id: string
  name: string
  thumbnail: string
  filePath: string
  warehouse: string
  brand: string
  uploadTime: string
  duration: string
  resolution: string
  status: VideoStatus
  fileSize: string
  videoAudit?: VideoAudit | null
  videoType?: string | null
  eventTimeline?: Array<{ ts: number; event: string; quality: number }> | null
}

export interface Activity {
  id: string
  type: 'upload' | 'process' | 'review' | 'export' | 'train'
  description: string
  timestamp: string
  user: string
}

export interface DashboardStats {
  uploadedVideos: number
  processingVideos: number
  needReview: number
  totalDataset: number
  aiModels: number
  storageUsed: string
  storageTotal: string
  storagePercent: number
}

export type DatasetStatus = 'Training' | 'Validation' | 'Pending'

export interface DatasetImage {
  id: string
  name: string
  preview: string
  sourceVideo: string
  status: DatasetStatus
  createdDate: string
}

export interface DatasetStats {
  totalImages: number
  trainingImages: number
  validationImages: number
}

export type ModelStatus = 'Not Trained' | 'Training' | 'Trained' | 'Deployed'

export interface AIModel {
  id: string
  name: string
  type: 'YOLO' | 'OCR' | 'Custom'
  description: string
  status: ModelStatus
  version: string
  lastUpdated: string
  accuracy?: number
}

export interface Warehouse {
  id: string
  name: string
  location: string
  createdAt: string
}

export interface Brand {
  id: string
  name: string
  code: string
  createdAt: string
}

export interface UserProfile {
  id: string
  name: string
  email: string
  role: string
  avatar?: string
}

export interface AIAnalysisResult {
  type: 'Tracking Code' | 'Barcode' | 'SKU' | 'OCR' | 'Packaging' | 'Product' | 'Quality'
  status: 'Waiting' | 'Processing' | 'Complete' | 'Failed'
  result?: string
}

// ── Phase 2 Types ────────────────────────────────────────────────────────────

export type ProcessingJobStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface ProcessingStep {
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  progress: number
  message: string
}

export interface ProcessingJob {
  id: string
  videoId: string
  videoName: string
  status: ProcessingJobStatus
  progress: number
  steps: {
    frameExtraction: ProcessingStep
    ocr: ProcessingStep
    tracking: ProcessingStep
    packagingDetection: ProcessingStep
    productDetection: ProcessingStep
    qualityDetection: ProcessingStep
  }
  startTime: string
  endTime?: string
  totalFrames: number
  selectedFrames: number
  discardedFrames: number
  blurFrames: number
  duplicateFrames: number
}

export type FrameQuality = 'excellent' | 'good' | 'fair' | 'poor'

export interface Frame {
  id: string
  jobId: string
  videoId: string
  timestamp: string
  thumbnailUrl: string
  blurScore: number
  ocrStatus: 'found' | 'not_found' | 'error'
  trackingFound: boolean
  frameQuality: FrameQuality
  isDuplicate: boolean
  brightness: number
}

export type Carrier = 'SPX' | 'JNT' | 'GHN' | 'GHTK' | 'NJVN' | 'unknown'

export interface OCRResult {
  id: string
  frameId: string
  detectedText: string
  confidence: number
  language: string
  status: 'verified' | 'pending' | 'failed'
  carrier: Carrier
  trackingCode: string
}

export interface BoundingBox {
  id: string
  label: string
  x: number
  y: number
  width: number
  height: number
  confidence: number
}

export interface Annotation {
  id: string
  frameId: string
  reviewer: string
  status: 'pending' | 'approved' | 'rejected'
  confidence: number
  boundingBoxes: BoundingBox[]
  createdAt: string
  updatedAt: string
}

export interface AnnotationReview {
  id: string
  annotationId: string
  reviewer: string
  reviewTime: string
  approvalStatus: 'approved' | 'rejected'
  comments: string
  confidence: number
}

export type BrightnessLevel = 'normal' | 'dark' | 'bright'

export interface Feature {
  id: string
  frameId: string
  trackingFound: boolean
  barcodeFound: boolean
  packagingType: string
  ocrConfidence: number
  blurScore: number
  brightness: BrightnessLevel
  frameQuality: FrameQuality
  rotation: number
  isDuplicate: boolean
}

export interface DatasetRecord {
  id: string
  name: string
  version: string
  totalImages: number
  trainingImages: number
  validationImages: number
  rejectedImages: number
  pendingReview: number
  createdAt: string
}

export type DatasetFormat = 'YOLO' | 'COCO' | 'PascalVOC' | 'JSON' | 'CSV'

export interface DatasetVersion {
  id: string
  datasetId: string
  version: 'v1' | 'v2' | 'v3'
  format: DatasetFormat
  exportedAt: string
  status: 'ready' | 'processing' | 'failed'
  changelog?: string
}

export type LogLevel = 'info' | 'warn' | 'error'

export interface ProcessingLog {
  id: string
  jobId: string
  level: LogLevel
  message: string
  timestamp: string
}

export type NotificationType = 'processing_complete' | 'ocr_failed' | 'frame_needs_review' | 'dataset_exported'

export interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  read: boolean
  createdAt: string
}

// ── Phase 3 Types — AI Annotation Engine ─────────────────────────────────────

export type TrackingLabelType =
  | 'TrackingLabel'
  | 'Barcode'
  | 'QRCode'
  | 'ProductRegion'
  | 'Packaging'
  | 'PossibleDamage'
  | 'OCRRegion'

export type SuggestionStatus = 'pending' | 'approved' | 'rejected' | 'edited'

export interface AIAnnotationSuggestion {
  id: string
  frameId: string
  label: TrackingLabelType
  boundingBox: { x: number; y: number; width: number; height: number }
  confidence: number
  reason: string
  status: SuggestionStatus
}

export type AnnotationJobStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface AnnotationJob {
  id: string
  name: string
  frameCount: number
  pendingCount: number
  approvedCount: number
  rejectedCount: number
  autoApprovedCount: number
  needReviewCount: number
  createdAt: string
  status: AnnotationJobStatus
}

export type KnowledgeRuleTarget = 'TrackingCode' | 'Barcode' | 'Packaging' | 'Product'
export type KnowledgeRuleType = 'regex' | 'min_confidence' | 'must_contain' | 'aspect_ratio'

export interface KnowledgeRule {
  id: string
  name: string
  target: KnowledgeRuleTarget
  type: KnowledgeRuleType
  value: string
  description: string
  active: boolean
}

export interface DuplicateGroup {
  id: string
  frames: { frameId: string; thumbnailUrl: string; timestamp: string; similarityScore: number }[]
  keepFrameId: string
  discardedCount: number
}

export type AnnotationHistoryAction = 'created' | 'edited' | 'approved' | 'rejected' | 'rolled_back'

export interface AnnotationHistoryEntry {
  id: string
  annotationId: string
  frameId: string
  action: AnnotationHistoryAction
  reviewer: string
  previousValue: unknown
  newValue: unknown
  timestamp: string
}

export interface ReviewSession {
  id: string
  reviewer: string
  startTime: string
  endTime: string
  framesReviewed: number
  approvals: number
  rejections: number
  edits: number
  avgReviewTimeMs: number
}

export interface AnnotationAnalytics {
  totalFramesReviewed: number
  approvalRate: number
  avgReviewTimeMs: number
  aiAccuracy: number
  ocrAccuracy: number
  duplicateReduction: number
  reviewerPerformance: { reviewer: string; framesReviewed: number; approvalRate: number; avgTimeMs: number }[]
  dailyProgress: { date: string; reviewed: number; approved: number; rejected: number }[]
}

export interface DatasetQualityScore {
  datasetId: string
  totalImages: number
  blurPercent: number
  duplicatesPercent: number
  ocrQuality: number
  annotationConsistency: number
  overallScore: number
}

export type ActiveLearningReason =
  | 'high_blur'
  | 'low_ocr'
  | 'unknown_packaging'
  | 'unknown_product'
  | 'unknown_damage'

export type ActiveLearningPriority = 'high' | 'medium' | 'low'

export interface ActiveLearningFrame {
  frameId: string
  thumbnailUrl: string
  reason: ActiveLearningReason
  priority: ActiveLearningPriority
  blurScore: number
  ocrConfidence: number
}

// ── Phase 4 Types — AI Training Center ────────────────────────────────────────

export type TrainingStatus = 'queued' | 'preparing' | 'training' | 'evaluating' | 'completed' | 'failed' | 'cancelled'
export type DeploymentType = 'development' | 'testing' | 'production' | 'edge'
export type DeploymentFormat = 'docker' | 'onnx' | 'tensorrt' | 'pytorch'

export interface HyperparamConfig {
  epochs: number
  batchSize: number
  imageSize: number
  learningRate: number
  optimizer: string
  scheduler: string
  earlyStoppingPatience: number
  workers: number
  randomSeed: number
  mixedPrecision: boolean
  resumeTraining: boolean
  autoSave: boolean
}

export interface TrainingTemplate {
  id: string
  name: string
  framework: string
  description: string
  supportedTasks: string[]
  defaultHyperparams: HyperparamConfig
}

export interface GPUNode {
  id: string
  name: string
  memoryTotal: number
  memoryUsed: number
  temperature: number
  power: number
  utilization: number
  status: 'available' | 'busy' | 'offline'
}

export interface TrainingLog {
  id: string
  jobId: string
  epoch?: number
  level: 'info' | 'warn' | 'error'
  message: string
  timestamp: string
}

export interface TrainingJob {
  id: string
  name: string
  modelTemplate: string
  datasetVersion: string
  datasetId: string
  status: TrainingStatus
  progress: number
  currentEpoch: number
  totalEpochs: number
  eta: string
  gpuId: string
  trainLoss: number
  valLoss: number
  accuracy: number
  mAP50: number
  mAP5095: number
  recall: number
  precision: number
  gpuUsage: number
  ramUsage: number
  diskUsage: number
  startTime: string
  endTime?: string
  createdBy: string
  logs: TrainingLog[]
}

export interface Experiment {
  id: string
  name: string
  datasetVersion: string
  modelTemplate: string
  epochs: number
  learningRate: number
  batchSize: number
  finalMaP50: number
  finalAccuracy: number
  finalRecall: number
  finalPrecision: number
  f1Score: number
  trainingTime: string
  inferenceSpeed: number
  modelSizeMB: number
  createdBy: string
  createdAt: string
  jobId: string
  status: TrainingStatus
}

export interface MetricPoint {
  epoch: number
  trainLoss: number
  valLoss: number
  precision: number
  recall: number
  mAP50: number
  mAP5095: number
}

export interface ModelVersion {
  id: string
  modelId: string
  version: string
  framework: string
  datasetVersion: string
  accuracy: number
  mAP50: number
  inferenceSpeedMs: number
  modelSizeMB: number
  status: 'active' | 'archived' | 'deprecated'
  deploymentStatus: 'deployed' | 'not_deployed' | 'deploying'
  createdAt: string
  createdBy: string
  description: string
  artifacts: string[]
  experimentId: string
}

export interface ModelRegistryEntry {
  id: string
  name: string
  task: string
  versions: ModelVersion[]
  latestVersion: string
  owner: string
  description: string
  createdAt: string
}

export interface Deployment {
  id: string
  modelId: string
  modelVersion: string
  modelName: string
  environment: DeploymentType
  format: DeploymentFormat
  status: 'deploying' | 'running' | 'stopped' | 'failed'
  endpoint?: string
  deployedAt: string
  deployedBy: string
  replicas: number
  cpuUsage: number
  memoryUsage: number
}

export interface EvaluationReport {
  id: string
  modelId: string
  modelVersion: string
  datasetVersion: string
  precision: number
  recall: number
  f1: number
  mAP50: number
  mAP5095: number
  totalImages: number
  falsePositives: number
  falseNegatives: number
  iou: number
  inferenceSpeedMs: number
  createdAt: string
}

export interface BenchmarkResult {
  id: string
  datasetVersion: string
  models: {
    modelTemplate: string
    accuracy: number
    speedMs: number
    memoryMB: number
    gpuUsage: number
    powerW: number
    overallScore: number
  }[]
  winner: string
  createdAt: string
}
