import { cn } from './utils';
export function Card({ className='', ...props }: React.HTMLAttributes<HTMLDivElement>){ return <div className={cn('rounded-2xl border bg-white', className)} {...props}/> }
export function CardHeader({ className='', ...props }: React.HTMLAttributes<HTMLDivElement>){ return <div className={cn('p-4 border-b', className)} {...props}/> }
export function CardTitle({ className='', ...props }: React.HTMLAttributes<HTMLDivElement>){ return <h3 className={cn('font-semibold', className)} {...props}/> }
export function CardContent({ className='', ...props }: React.HTMLAttributes<HTMLDivElement>){ return <div className={cn('p-4', className)} {...props}/> }
