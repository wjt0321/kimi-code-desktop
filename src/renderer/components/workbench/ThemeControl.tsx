import { Monitor, Moon, Sun } from 'lucide-react';

import type { DesktopThemeSnapshot, ThemePreference } from '../../../shared/contracts';

interface ThemeControlProps {
  theme: DesktopThemeSnapshot;
  onChange(preference: ThemePreference): void;
}

const options = [
  { value: 'system' as const, label: '跟随系统', icon: Monitor },
  { value: 'light' as const, label: '浅色', icon: Sun },
  { value: 'dark' as const, label: '深色', icon: Moon },
];

export function ThemeControl({ theme, onChange }: ThemeControlProps) {
  return (
    <div className="theme-control" role="radiogroup" aria-label="外观主题">
      {options.map((option) => {
        const Icon = option.icon;
        const checked = theme.preference === option.value;
        return <button key={option.value} type="button" role="radio" aria-checked={checked} className={checked ? 'theme-control__option is-selected' : 'theme-control__option'} onClick={() => onChange(option.value)}><Icon size={15} /><span>{option.label}</span></button>;
      })}
    </div>
  );
}
