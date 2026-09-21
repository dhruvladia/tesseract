import { Suspense, lazy } from 'react'
import { Skeleton } from '@/components/ui/skeleton'

const Editor = lazy(() => import('./editor'))

export function DescriptionEditor(props: React.ComponentProps<typeof Editor>) {
  return (
    <Suspense fallback={<Skeleton className="h-[120px] w-full" />}>
      <Editor {...props} />
    </Suspense>
  )
}
