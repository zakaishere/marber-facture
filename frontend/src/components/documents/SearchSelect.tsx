import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';

interface Option { value: string; label: string; detail?: string }
export default function SearchSelect({ id, label, value, options, placeholder, onChange }: {
  id?: string; label: string; value: string; options: Option[]; placeholder: string; onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false); const selected = options.find(option => option.value === value);
  return <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Button type="button" id={id} role="combobox" aria-label={label} aria-expanded={open} variant="outline" className="w-full justify-between font-normal bg-white min-w-0 px-3">
    <span className={`truncate ${selected ? '' : 'text-muted-foreground'}`}>{selected?.label || placeholder}</span><ChevronsUpDown className="h-4 w-4 shrink-0 ml-2 opacity-40" />
  </Button></PopoverTrigger><PopoverContent align="start" className="p-0 w-[min(380px,calc(100vw-32px))]"><Command><CommandInput placeholder="Rechercher par nom ou référence…" aria-label={`Rechercher ${label.toLowerCase()}`} /><CommandList><CommandEmpty>Aucun résultat.</CommandEmpty><CommandGroup>{options.map(option => <CommandItem key={option.value} value={`${option.label} ${option.detail || ''} ${option.value}`} onSelect={() => { onChange(option.value); setOpen(false); }}>
    <Check className={`mr-2 h-4 w-4 shrink-0 ${value === option.value ? 'opacity-100' : 'opacity-0'}`} /><div className="min-w-0"><p className="truncate">{option.label}</p>{option.detail && <p className="text-xs text-muted-foreground truncate">{option.detail}</p>}</div>
  </CommandItem>)}</CommandGroup></CommandList></Command></PopoverContent></Popover>;
}
