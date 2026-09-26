import React from 'react';
import { Box, Typography, Paper, List, ListItem, ListItemText, Link } from '@mui/material';
import { useLanguage } from '../../i18n/LanguageContext';

const DOCS = [
  { file: 'methodology.md', titleKey: 'docs.methodology' },
  { file: 'assumptions.md', titleKey: 'docs.assumptions' },
  { file: 'reproducibility.md', titleKey: 'docs.reproducibility' },
  { file: 'limitations.md', titleKey: 'docs.limitations' },
  { file: 'legacy-cdss.md', titleKey: 'docs.legacyCdss' },
  { file: 'paper-outline.md', titleKey: 'docs.paperOutline' },
  { file: 'migration-final-research.md', titleKey: 'docs.migration' },
];

export default function Documentation() {
  const { t } = useLanguage();
  const repoBase = 'https://github.com/zhengjiewu39-lab/Traditional-Chinese-Medicine-Pharmacy/blob/main/chinese-medicine-pharmacy/docs';

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>{t('docsPage.title')}</Typography>
      <Typography variant="body2" color="text.secondary" paragraph>{t('docsPage.intro')}</Typography>
      <Paper sx={{ p: 2 }}>
        <List>
          {DOCS.map((d) => (
            <ListItem key={d.file} divider>
              <ListItemText
                primary={t(d.titleKey)}
                secondary={
                  <Link href={`${repoBase}/${d.file}`} target="_blank" rel="noopener noreferrer">
                    docs/{d.file}
                  </Link>
                }
              />
            </ListItem>
          ))}
        </List>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 2 }}>
          {t('docsPage.localHint')}
        </Typography>
      </Paper>
    </Box>
  );
}
