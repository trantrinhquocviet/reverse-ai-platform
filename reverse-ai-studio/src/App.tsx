import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppLayout } from '@/layouts/AppLayout'
import { AuthGuard } from '@/components/AuthGuard'
import { Login } from '@/pages/Login'
import { Dashboard } from '@/pages/Dashboard'
import { VideoCenter } from '@/pages/VideoCenter'
import { VideoDetail } from '@/pages/VideoDetail'
import { Dataset } from '@/pages/Dataset'
import { AIModels } from '@/pages/AIModels'
import { Settings } from '@/pages/Settings'
import { AIProcessing } from '@/pages/AIProcessing'
import { AIJobDetail } from '@/pages/AIJobDetail'
import { FrameGallery } from '@/pages/FrameGallery'
import { AnnotationQueue } from '@/pages/AnnotationQueue'
import { AnnotationTool } from '@/pages/AnnotationTool'
import { ReviewQueue } from '@/pages/ReviewQueue'
import { FeatureExplorer } from '@/pages/FeatureExplorer'
import { DatasetManager } from '@/pages/DatasetManager'
import { AutoAnnotation } from '@/pages/AutoAnnotation'
import { AutoAnnotationJob } from '@/pages/AutoAnnotationJob'
import { AnnotationEditor } from '@/pages/AnnotationEditor'
import { ReviewCenter } from '@/pages/ReviewCenter'
import { AnnotationAnalytics } from '@/pages/AnnotationAnalytics'
import { KnowledgeRules } from '@/pages/KnowledgeRules'
import { DatasetExplorer } from '@/pages/DatasetExplorer'
import { DuplicateDetection } from '@/pages/DuplicateDetection'
import { TrainingCenter } from '@/pages/TrainingCenter'
import { TrainingJobs } from '@/pages/TrainingJobs'
import { TrainingJobDetail } from '@/pages/TrainingJobDetail'
import { Experiments } from '@/pages/Experiments'
import { ModelRegistry } from '@/pages/ModelRegistry'
import { Evaluation } from '@/pages/Evaluation'
import { Deployment } from '@/pages/Deployment'
import { GPUMonitor } from '@/pages/GPUMonitor'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      retry: 1,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<AuthGuard><AppLayout /></AuthGuard>}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/videos" element={<VideoCenter />} />
            <Route path="/videos/:id" element={<VideoDetail />} />
            <Route path="/ai-processing" element={<AIProcessing />} />
            <Route path="/ai-processing/:jobId" element={<AIJobDetail />} />
            <Route path="/ai-processing/:jobId/frames" element={<FrameGallery />} />
            <Route path="/annotation-queue" element={<AnnotationQueue />} />
            <Route path="/annotation/:frameId" element={<AnnotationTool />} />
            <Route path="/review-queue" element={<ReviewQueue />} />
            <Route path="/feature-explorer" element={<FeatureExplorer />} />
            <Route path="/dataset" element={<DatasetManager />} />
            <Route path="/dataset-legacy" element={<Dataset />} />
            <Route path="/models" element={<AIModels />} />
            <Route path="/settings" element={<Settings />} />
            {/* Phase 3 — AI Annotation Engine */}
            <Route path="/auto-annotation" element={<AutoAnnotation />} />
            <Route path="/auto-annotation/:jobId" element={<AutoAnnotationJob />} />
            <Route path="/annotation-editor/:frameId" element={<AnnotationEditor />} />
            <Route path="/review-center" element={<ReviewCenter />} />
            <Route path="/annotation-analytics" element={<AnnotationAnalytics />} />
            <Route path="/knowledge-rules" element={<KnowledgeRules />} />
            <Route path="/dataset-explorer" element={<DatasetExplorer />} />
            <Route path="/duplicate-detection" element={<DuplicateDetection />} />
            {/* Phase 4 — AI Training Center */}
            <Route path="/training-center" element={<TrainingCenter />} />
            <Route path="/training-jobs" element={<TrainingJobs />} />
            <Route path="/training-jobs/:jobId" element={<TrainingJobDetail />} />
            <Route path="/experiments" element={<Experiments />} />
            <Route path="/model-registry" element={<ModelRegistry />} />
            <Route path="/evaluation" element={<Evaluation />} />
            <Route path="/deployment" element={<Deployment />} />
            <Route path="/gpu-monitor" element={<GPUMonitor />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
