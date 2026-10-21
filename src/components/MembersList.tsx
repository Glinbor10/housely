import { useState } from 'react'
import { Alert, Avatar, Button, Card, CardContent, Stack, Typography } from '@mui/material'
import { useTranslation } from '../i18n/useTranslation'

interface Person {
  id: string
  name: string
  // Whether a phone has claimed this person
  claimed: boolean
}

interface MembersListProps {
  members: Person[]
  currentMemberId: string
  // Only the owner of the flat can release people
  canManage: boolean
  busy: boolean
  error: string | null
  onRelease: (memberId: string) => void
}

export const MembersList = ({
  members,
  currentMemberId,
  canManage,
  busy,
  error,
  onRelease,
}: MembersListProps) => {
  const { t } = useTranslation()
  const [confirming, setConfirming] = useState<string | null>(null)

  return (
    <Stack spacing={1}>
      <Typography variant="h6">{t('people.title')}</Typography>
      {members.map((member) => {
        const isMe = member.id === currentMemberId
        return (
          <Card key={member.id} variant="outlined">
            <CardContent>
              <Stack spacing={1}>
                <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                  <Avatar
                    aria-hidden="true"
                    sx={{ bgcolor: member.claimed ? 'primary.main' : 'action.disabled' }}
                  >
                    {member.name.charAt(0).toUpperCase()}
                  </Avatar>
                  <Typography sx={{ flexGrow: 1, fontWeight: 700 }}>
                    {isMe ? t('common.you', { name: member.name }) : member.name}
                  </Typography>
                  {member.claimed ? (
                    canManage && !isMe ? (
                      <Button
                        size="small"
                        color="warning"
                        aria-label={t('people.releaseAria', { name: member.name })}
                        onClick={() => setConfirming(member.id)}
                      >
                        {t('people.release')}
                      </Button>
                    ) : null
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      {t('people.waiting', { name: member.name })}
                    </Typography>
                  )}
                </Stack>
                {confirming === member.id ? (
                  <Alert
                    severity="warning"
                    action={
                      <Stack direction="row" spacing={1}>
                        <Button color="inherit" onClick={() => setConfirming(null)}>
                          {t('common.cancel')}
                        </Button>
                        <Button
                          color="inherit"
                          disabled={busy}
                          onClick={() => {
                            onRelease(member.id)
                            setConfirming(null)
                          }}
                        >
                          {t('people.confirmYes')}
                        </Button>
                      </Stack>
                    }
                  >
                    {t('people.confirm', { name: member.name })}
                  </Alert>
                ) : null}
              </Stack>
            </CardContent>
          </Card>
        )
      })}
      {error ? <Alert severity="error">{error}</Alert> : null}
    </Stack>
  )
}
