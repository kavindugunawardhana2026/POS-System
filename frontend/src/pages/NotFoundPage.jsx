import { useTranslation } from 'react-i18next'

export default function NotFoundPage() {
  const { t } = useTranslation()
  return <div style={{ textAlign: 'center', padding: '80px' }}><h1>404</h1><p>{t('common.not_found', 'Page not found.')}</p></div>
}
