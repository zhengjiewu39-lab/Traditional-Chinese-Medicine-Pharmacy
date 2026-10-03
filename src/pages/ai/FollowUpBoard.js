import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { aiFollowUpApi } from '../../services/aiApi';
import { formatApiError } from '../../config/httpClient';
import { useLanguage } from '../../i18n/LanguageContext';

export default function FollowUpBoard() {
  const { t } = useLanguage();
  const [tasks, setTasks] = useState([]);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const load = useCallback(async () => {
    try {
      const r = await aiFollowUpApi.list();
      setTasks(r.data.tasks || []);
      setError('');
    } catch (e) {
      setError(formatApiError(e));
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  const act = async (task, action) => {
    try {
      await aiFollowUpApi.act(task.caseId, task.taskId, { action, note, summary: note });
      setNote('');
      await load();
    } catch (e) {
      setError(formatApiError(e));
    }
  };
  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>{t('nav.followUp')}</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Alert severity="info" sx={{ mb: 2 }}>{t('ai.follow.warn')}</Alert>
      <TextField size="small" label={t('ai.follow.note')} value={note} onChange={(e) => setNote(e.target.value)} sx={{ mb: 2, minWidth: 320 }} />
      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('ai.follow.case')}</TableCell>
              <TableCell>{t('ai.patient')}</TableCell>
              <TableCell>{t('ai.intake.patientRef')}</TableCell>
              <TableCell>{t('ai.follow.status')}</TableCell>
              <TableCell>{t('ai.follow.owner')}</TableCell>
              <TableCell>{t('ai.follow.due')}</TableCell>
              <TableCell>{t('ai.follow.notify')}</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {tasks.map((task) => (
              <TableRow key={task.taskId}>
                <TableCell sx={{ fontFamily: 'monospace' }}>{String(task.caseId).slice(-8)}</TableCell>
                <TableCell>{task.patientName || task.patientLabel || '—'}</TableCell>
                <TableCell sx={{ fontFamily: 'monospace' }}>{task.patientRef || '—'}</TableCell>
                <TableCell>{task.status}{task.overdue ? ` / ${t('ai.follow.overdue')}` : ''}</TableCell>
                <TableCell>{task.owner || '—'}</TableCell>
                <TableCell>{task.dueAt || '—'}</TableCell>
                <TableCell>{task.notifyNote || t('ai.follow.warn')}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={1}>
                    <Button size="small" onClick={() => act(task, 'assign')}>{t('ai.follow.assign')}</Button>
                    <Button size="small" onClick={() => act(task, 'contact')}>{t('ai.follow.contact')}</Button>
                    <Button size="small" onClick={() => act(task, 'close')}>{t('ai.follow.close')}</Button>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
            {!tasks.length && <TableRow><TableCell colSpan={8} align="center">{t('ai.follow.empty')}</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}
