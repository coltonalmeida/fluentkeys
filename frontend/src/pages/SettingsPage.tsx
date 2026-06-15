import { SignedIn, SignedOut } from '@clerk/clerk-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'
import { KeyboardVisual } from '../components/KeyboardVisual'
import { usePreferences } from '../hooks/usePreferences'
import { getLayout, KEYBOARD_LAYOUTS, type LayoutId } from '../lib/keyboard'
import {
  FONTS,
  LANGUAGES,
  type FontId,
  type LanguageId,
  type Theme,
} from '../lib/preferences'

export function SettingsPage() {
  const { t } = useTranslation()
  const { prefs, update, reset } = usePreferences()
  const previewLayout = useMemo(() => getLayout(prefs.keyboardLayout), [prefs.keyboardLayout])

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{t('settings.title')}</h1>

      {/* Appearance: theme + test font with a live preview. */}
      <Card title={t('settings.appearance')}>
        <Field label={t('settings.theme')}>
          <Segmented<Theme>
            value={prefs.theme}
            options={[
              ['light', t('settings.themeLight')],
              ['dark', t('settings.themeDark')],
            ]}
            onChange={(theme) => update({ theme })}
          />
        </Field>

        <Field label={t('settings.font')} hint={t('settings.fontHint')}>
          <select
            value={prefs.font}
            onChange={(e) => update({ font: e.target.value as FontId })}
            className={selectClass}
          >
            {(Object.keys(FONTS) as FontId[]).map((id) => (
              <option key={id} value={id}>
                {FONTS[id].label}
              </option>
            ))}
          </select>
        </Field>

        <div
          className="rounded-lg bg-zinc-100 px-5 py-4 text-2xl text-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-100"
          style={{ fontFamily: FONTS[prefs.font].stack }}
        >
          {t('settings.fontPreview')}
        </div>
      </Card>

      {/* Keyboard: layout selector with a live re-render of the visual board. */}
      <Card title={t('settings.keyboard')}>
        <Field label={t('settings.layout')} hint={t('settings.layoutHint')}>
          <select
            value={prefs.keyboardLayout}
            onChange={(e) => update({ keyboardLayout: e.target.value as LayoutId })}
            className={selectClass}
          >
            {(Object.keys(KEYBOARD_LAYOUTS) as LayoutId[]).map((id) => (
              <option key={id} value={id}>
                {KEYBOARD_LAYOUTS[id].label}
              </option>
            ))}
          </select>
        </Field>

        <div className="overflow-x-auto">
          <div className="min-w-fit origin-top-left scale-90">
            <KeyboardVisual nextChar={null} flashKeyId={null} showInfo={false} layout={previewLayout} />
          </div>
        </div>
      </Card>

      {/* Language: UI only — tests stay in English. */}
      <Card title={t('settings.language')}>
        <Field label={t('settings.uiLanguage')} hint={t('settings.uiLanguageHint')}>
          <select
            value={prefs.language}
            onChange={(e) => update({ language: e.target.value as LanguageId })}
            className={selectClass}
          >
            {(Object.keys(LANGUAGES) as LanguageId[]).map((id) => (
              <option key={id} value={id}>
                {LANGUAGES[id].flag} {LANGUAGES[id].label}
              </option>
            ))}
          </select>
        </Field>
      </Card>

      {/* Account: where preferences live. */}
      <Card title={t('settings.account')}>
        <SignedOut>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('settings.accountGuest')}</p>
        </SignedOut>
        <SignedIn>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('settings.accountSynced')}</p>
        </SignedIn>
      </Card>

      <div>
        <button
          type="button"
          onClick={reset}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-600 transition-colors hover:bg-zinc-200 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          {t('common.reset')}
        </button>
      </div>
    </div>
  )
}

const selectClass =
  'rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100'

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-xl bg-zinc-200/60 p-6 dark:bg-zinc-800/50">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {title}
      </h2>
      {children}
    </section>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <div className="text-sm font-medium text-zinc-700 dark:text-zinc-200">{label}</div>
        {hint && <div className="text-xs text-zinc-500 dark:text-zinc-500">{hint}</div>}
      </div>
      {children}
    </div>
  )
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: [T, string][]
  onChange: (value: T) => void
}) {
  return (
    <div className="flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-900/60">
      {options.map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={`rounded-md px-3 py-1 text-sm transition-colors ${
            value === id
              ? 'bg-emerald-500 font-medium text-zinc-900'
              : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
