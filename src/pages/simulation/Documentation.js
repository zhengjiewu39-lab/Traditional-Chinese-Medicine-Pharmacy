import React from 'react';
import {
  Box, Typography, Paper, List, ListItem, ListItemText, Link, Divider,
} from '@mui/material';
import { useLanguage } from '../../i18n/LanguageContext';
import { SIMULATION_DOC_SECTIONS, githubBlobUrl, GITHUB_REPO } from '../../config/repositoryDocs';

export default function Documentation() {
  const { t } = useLanguage();

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>{t('docsPage.title')}</Typography>
      <Typography variant="body2" color="text.secondary" paragraph>{t('docsPage.intro')}</Typography>
      <Typography variant="body2" sx={{ mb: 2 }}>
        <Link href={GITHUB_REPO} target="_blank" rel="noopener noreferrer">{GITHUB_REPO}</Link>
      </Typography>
      {SIMULATION_DOC_SECTIONS.map((section) => (
        <Paper key={section.sectionKey} sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            {t(section.sectionKey)}
          </Typography>
          <List dense disablePadding>
            {section.items.map((d) => (
              <ListItem key={d.path} divider sx={{ px: 0 }}>
                <ListItemText
                  primary={t(d.titleKey)}
                  secondary={
                    <Link href={githubBlobUrl(d.path)} target="_blank" rel="noopener noreferrer">
                      {d.path}
                    </Link>
                  }
                />
              </ListItem>
            ))}
          </List>
        </Paper>
      ))}
      <Divider sx={{ my: 2 }} />
      <Typography variant="caption" color="text.secondary" display="block">
        {t('docsPage.localHint')}
      </Typography>
    </Box>
  );
}
