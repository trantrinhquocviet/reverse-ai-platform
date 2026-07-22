import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/utils/cn'

interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  totalItems?: number
  itemsPerPage?: number
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  itemsPerPage,
}: PaginationProps) {
  if (totalPages <= 1) return null

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
  const startItem = totalItems && itemsPerPage ? (currentPage - 1) * itemsPerPage + 1 : null
  const endItem = totalItems && itemsPerPage ? Math.min(currentPage * itemsPerPage, totalItems) : null

  return (
    <div className="flex items-center justify-between mt-4">
      {startItem && endItem && totalItems ? (
        <p className="text-xs text-[#8888a8]">
          Showing {startItem}–{endItem} of {totalItems} items
        </p>
      ) : (
        <div />
      )}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-1.5 rounded-[6px] text-[#8888a8] hover:text-[#f0f0f5] hover:bg-[#ffffff08] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        {pages.map((page) => (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={cn(
              'min-w-[32px] h-8 px-2 rounded-[6px] text-xs font-medium transition-colors',
              currentPage === page
                ? 'bg-[#7c6af7] text-white'
                : 'text-[#8888a8] hover:text-[#f0f0f5] hover:bg-[#ffffff08]'
            )}
          >
            {page}
          </button>
        ))}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-1.5 rounded-[6px] text-[#8888a8] hover:text-[#f0f0f5] hover:bg-[#ffffff08] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
