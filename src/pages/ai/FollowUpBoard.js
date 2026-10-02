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
      <Alert severity="info" sx={{ mb: 2 }}>AI cannot close these tasks. Unsent notifications stay marked in-app only.</Alert>
      <TextField size="small" label="Note / close summary" value={note} onChange={(e) => setNote(e.target.value)} sx={{ mb: 2, minWidth: 320 }} />
      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Case</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Owner</TableCell>
              <TableCell>Due</TableCell>
              <TableCell>Notify</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {tasks.map((task) => (
              <TableRow key={task.taskId}>
                <TableCell sx={{ fontFamily: 'monospace' }}>{String(task.caseId).slice(-8)}</TableCell>
                <TableCell>{task.status}{task.overdue ? ' / overdue' : ''}</TableCell>
                <TableCell>{task.owner || '—'}</TableCell>
                <TableCell>{task.dueAt || '—'}</TableCell>
                <TableCell>{task.notifyNote || '仅站内待办，未发送'}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={1}>
                    <Button size="small" onClick={() => act(task, 'assign')}>Assign</Button>
                    <Button size="small" onClick={() => act(task, 'contact')}>Contact</Button>
                    <Button size="small" onClick={() => act(task, 'close')}>Close</Button>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
            {!tasks.length && <TableRow><TableCell colSpan={6} align="center">No open follow-up tasks</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}
