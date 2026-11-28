import { MIN_TOUCH_TARGET, SIZE } from '../theme'
import { useState } from 'react'
import {
  Alert,
  Avatar,
  Box,
  Button,
  ButtonBase,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Typography,
} from '@mui/material'
import { m } from 'motion/react'
import { readableOn } from '../domain/color'
import { useTranslation } from '../i18n/useTranslation'
import { ColorPicker } from './ColorPicker'
import { CheckIcon, GoogleIcon, GoogleWarningIcon, MoreIcon, PaletteIcon } from './icons'

interface Person {
  id: string
  name: string
  // Whether a phone has claimed this person
  claimed: boolean
  color: string
  // The person who created the flat
  isCreator: boolean
  // The identity of the phone that claimed this person, to hand the flat over to them
  uid?: string
  // Whether they have Google linked: only those can be made owner
  hasGoogle: boolean
}

interface MembersListProps {
  members: Person[]
  currentMemberId: string
  // Only the owner of the flat can release people
  canManage: boolean
  busy: boolean
  error: string | null
  colorBusy: boolean
  onRelease: (memberId: string) => void
  handOverBusy: boolean
  handOverError: string | null
  // Gives the flat to the identity of that person
  onHandOver: (uid: string) => void
  // The current person picks their own color
  onChangeColor: (hex: string) => void
}

// The people of the flat. Each one has their color; the creator of the flat is marked and so is the
// current person. Only the current person has a pencil on their avatar, which opens the colors that
// nobody else has.
export const MembersList = ({
  members,
  currentMemberId,
  canManage,
  busy,
  error,
  colorBusy,
  onRelease,
  handOverBusy,
  handOverError,
  onHandOver,
  onChangeColor,
}: MembersListProps) => {
  const { t } = useTranslation()
  const [confirming, setConfirming] = useState<string | null>(null)
  const [pickingColor, setPickingColor] = useState(false)
  // The row whose menu is open, and the person who may become the owner (the dialog asks)
  const [menu, setMenu] = useState<{ id: string; anchor: HTMLElement } | null>(null)
  const [makingOwner, setMakingOwner] = useState<Person | null>(null)

  return (
    <Stack spacing={1}>
      <Typography variant="h6" component="h2">
        {t('people.title')}
      </Typography>
      <Stack component="ul" spacing={1} sx={{ listStyle: 'none', p: 0, m: 0 }}>
        {members.map((member, index) => {
          const isMe = member.id === currentMemberId
          const avatar = (
            <Avatar
              aria-hidden="true"
              data-testid="avatar"
              sx={{
                width: SIZE.avatarLg,
                height: SIZE.avatarLg,
                bgcolor: member.color,
                color: readableOn(member.color),
              }}
            >
              {member.name.charAt(0).toUpperCase()}
            </Avatar>
          )
          return (
            <m.li
              key={member.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 24, delay: index * 0.05 }}
            >
              <Card component="div" variant="outlined">
                <CardContent>
                  <Stack spacing={1}>
                    <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                      {isMe ? (
                        <ButtonBase
                          aria-label={t('people.changeColor')}
                          aria-expanded={pickingColor}
                          onClick={() => setPickingColor(!pickingColor)}
                          sx={{ position: 'relative', borderRadius: '50%', flexShrink: 0 }}
                        >
                          {avatar}
                          <Box
                            aria-hidden="true"
                            sx={{
                              position: 'absolute',
                              right: -4,
                              bottom: -4,
                              width: SIZE.badge,
                              height: SIZE.badge,
                              borderRadius: '50%',
                              display: 'grid',
                              placeItems: 'center',
                              bgcolor: 'background.paper',
                              border: 1,
                              borderColor: 'divider',
                              color: 'text.primary',
                            }}
                          >
                            <PaletteIcon sx={{ fontSize: 14 }} />
                          </Box>
                        </ButtonBase>
                      ) : (
                        avatar
                      )}
                      <Stack
                        spacing={0.5}
                        sx={{ flexGrow: 1, minWidth: 0, alignItems: 'flex-start' }}
                      >
                        <Typography sx={{ fontWeight: 700 }}>
                          {isMe ? t('common.you', { name: member.name }) : member.name}
                        </Typography>
                        {member.isCreator ? (
                          <Chip size="small" variant="outlined" label={t('people.creator')} />
                        ) : null}
                        {member.claimed ? (
                          // Everybody sees who has Google: only they can be made owner of the flat
                          member.hasGoogle ? (
                            <Chip
                              size="small"
                              variant="outlined"
                              icon={<GoogleIcon />}
                              label={
                                <Stack
                                  component="span"
                                  direction="row"
                                  spacing={0.5}
                                  sx={{ alignItems: 'center' }}
                                >
                                  <span>{t('people.withGoogle')}</span>
                                  <CheckIcon sx={{ fontSize: 14, color: 'success.main' }} />
                                </Stack>
                              }
                            />
                          ) : (
                            <Chip
                              size="small"
                              variant="outlined"
                              icon={<GoogleWarningIcon />}
                              label={t('people.withoutGoogle')}
                              sx={{
                                '& .MuiChip-icon': {
                                  fontSize: 16,
                                  ml: 0.75,
                                },
                              }}
                            />
                          )
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            {t('people.waiting', { name: member.name })}
                          </Typography>
                        )}
                      </Stack>
                      {member.claimed && canManage && !isMe ? (
                        <>
                          <IconButton
                            aria-label={t('people.menuAria', { name: member.name })}
                            aria-haspopup="menu"
                            sx={{ width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET }}
                            onClick={(event) =>
                              setMenu({ id: member.id, anchor: event.currentTarget })
                            }
                          >
                            <MoreIcon />
                          </IconButton>
                          <Menu
                            open={menu?.id === member.id}
                            anchorEl={menu?.anchor}
                            onClose={() => setMenu(null)}
                          >
                            <MenuItem
                              onClick={() => {
                                setMenu(null)
                                setMakingOwner(member)
                              }}
                            >
                              {t('people.makeOwner')}
                            </MenuItem>
                            <MenuItem
                              aria-label={t('people.releaseAria', { name: member.name })}
                              onClick={() => {
                                setMenu(null)
                                setConfirming(member.id)
                              }}
                            >
                              {t('people.release')}
                            </MenuItem>
                          </Menu>
                        </>
                      ) : null}
                    </Stack>
                    {isMe && pickingColor ? (
                      <ColorPicker
                        value={member.color}
                        takenBy={Object.fromEntries(
                          members
                            .filter((other) => other.id !== member.id)
                            .map((other) => [other.color, other.name]),
                        )}
                        busy={colorBusy}
                        onChange={(hex) => {
                          onChangeColor(hex)
                          setPickingColor(false)
                        }}
                      />
                    ) : null}
                    {confirming === member.id ? (
                      <Alert
                        severity="warning"
                        action={
                          <Stack direction="row" spacing={1}>
                            <Button color="inherit" onClick={() => setConfirming(null)}>
                              {t('common.cancel')}
                            </Button>
                            <Button
                              color="error"
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
            </m.li>
          )
        })}
      </Stack>
      {error ? <Alert severity="error">{error}</Alert> : null}
      <Dialog open={makingOwner !== null} onClose={() => setMakingOwner(null)} fullWidth>
        <DialogTitle>{t('people.makeOwnerTitle', { name: makingOwner?.name ?? '' })}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {makingOwner?.hasGoogle
              ? t('people.makeOwnerConfirm', { name: makingOwner.name })
              : t('people.needsGoogle', { name: makingOwner?.name ?? '' })}
          </DialogContentText>
          {handOverError ? (
            <Alert severity="error" sx={{ mt: 2 }}>
              {handOverError}
            </Alert>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMakingOwner(null)}>
            {makingOwner?.hasGoogle ? t('common.cancel') : t('common.close')}
          </Button>
          {makingOwner?.hasGoogle && makingOwner.uid ? (
            <Button
              color="warning"
              variant="contained"
              disabled={handOverBusy}
              onClick={() => onHandOver(makingOwner.uid as string)}
            >
              {t('people.makeOwnerYes')}
            </Button>
          ) : null}
        </DialogActions>
      </Dialog>
    </Stack>
  )
}
