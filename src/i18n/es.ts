import type { en } from './en'

export const es: Record<keyof typeof en, string> = {
  // Shared
  'common.back': 'Atrás',
  'common.cancel': 'Cancelar',
  'common.loading': 'Cargando',
  'common.remove': 'Quitar',
  'common.save': 'Guardar',
  'common.saving': 'Guardando...',
  'common.you': '{name} (tú)',
  'common.somethingWentWrong': 'Algo ha ido mal. Inténtalo de nuevo.',
  'common.language': 'Idioma',

  // Welcome
  'welcome.logoAlt': 'Logotipo de Housely',
  'welcome.tagline':
    'Repartid las tareas del piso: cada semana a cada persona le toca una zona y la rotación hace el resto.',
  'welcome.create': 'Crear un piso',
  'welcome.join': 'Unirme a un piso',
  'welcome.signIn': 'Ya tengo un piso',

  // Google
  'google.title': 'Crea tu piso con Google',
  'google.why':
    'Tu piso sigue siendo tuyo: con tu cuenta de Google podrás encontrarlo desde cualquier móvil, incluso si pierdes este.',
  'google.flatmates':
    'Tus compañeros no necesitan Google: se unen con el código de invitación y pueden vincular su cuenta más tarde si quieren.',
  'google.continue': 'Continuar con Google',
  'google.opening': 'Abriendo Google...',
  'google.cancelled': 'Inicio de sesión cancelado.',
  'google.error.popup-blocked':
    'Tu navegador ha bloqueado la ventana de Google. Permite las ventanas emergentes de este sitio e inténtalo de nuevo.',
  'google.error.not-enabled': 'Iniciar sesión con Google aún no está activado para esta app.',
  'google.error.unauthorized-domain':
    'Esta dirección no está autorizada para iniciar sesión con Google.',
  'google.error.account-in-use':
    'Esa cuenta de Google ya pertenece a otro perfil. Usa otra cuenta de Google, o inicia sesión con esta desde la pantalla de inicio.',
  'google.error.network': 'Sin conexión. Revisa tu red e inténtalo de nuevo.',
  'google.error.unknown': 'No se ha podido iniciar sesión con Google. Inténtalo de nuevo.',

  // Save access banner
  'saveAccess.text':
    'Guarda tu acceso: vincula tu cuenta de Google (opcional) para poder volver a este piso desde otro móvil.',
  'saveAccess.notNow': 'Ahora no',
  'saveAccess.link': 'Vincular Google',
  'saveAccess.linking': 'Vinculando...',

  // My flats
  'myFlats.title': 'Tus pisos',
  'myFlats.looking': 'Buscando tus pisos...',
  'myFlats.none':
    'No hemos encontrado ningún piso para esta cuenta de Google. Si te invitaron a uno, vuelve atrás y únete con el código de invitación.',

  // Join
  'join.title': 'Unirme a un piso',
  'join.ask': 'Pide a un compañero el código de invitación de tu piso.',
  'join.code': 'Código de invitación',
  'join.continue': 'Continuar',
  'join.searching': 'Buscando...',
  'join.joining': 'Unirte a {name}',
  'join.who': '¿Quién eres?',
  'join.allTaken':
    'Todas las personas de este piso ya están cogidas. Pide a quien lo creó que te añada.',
  'join.unknownCode': 'Ese código de invitación no existe. Revísalo e inténtalo de nuevo.',

  // Create flat
  'create.title': 'Crear un piso',
  'create.flatName': 'Nombre del piso',
  'create.people': 'Personas (en orden de rotación)',
  'create.personIsMe': 'La persona {n} soy yo',
  'create.person': 'Persona {n}',
  'create.removePerson': 'Quitar a la persona {n}',
  'create.addPerson': 'Añadir persona',
  'create.selectMe': 'Marca el círculo junto a la persona que eres tú.',
  'create.zones': 'Zonas que limpiar',
  'create.zone': 'Zona {n}',
  'create.removeZone': 'Quitar la zona {n}',
  'create.addZone': 'Añadir zona',
  'create.start': 'Inicio de la rotación',
  'create.submit': 'Crear piso',
  'create.creating': 'Creando...',
  'create.suggestedZones': 'Salón|Cocina|Baño',
  'create.error.flat-name-required': 'Ponle un nombre al piso.',
  'create.error.flat-name-too-long':
    'El nombre del piso es demasiado largo (60 caracteres como máximo).',
  'create.error.members-required': 'Añade al menos una persona.',
  'create.error.members-too-many': 'Hay demasiadas personas (20 como máximo).',
  'create.error.member-name-too-long':
    'El nombre de una persona es demasiado largo (40 caracteres como máximo).',
  'create.error.members-duplicated': 'Dos personas tienen el mismo nombre.',
  'create.error.zones-required': 'Añade al menos una zona.',
  'create.error.zones-too-many': 'Hay demasiadas zonas (20 como máximo).',
  'create.error.zone-name-too-long':
    'El nombre de una zona es demasiado largo (60 caracteres como máximo).',
  'create.error.zone-name-invalid': 'Los nombres de las zonas no pueden contener una barra.',
  'create.error.zones-duplicated': 'Dos zonas tienen el mismo nombre.',
  'create.error.start-date-invalid': 'Elige una fecha de inicio válida para la rotación.',
  'create.error.owner-required': 'Elige cuál de las personas eres tú.',
  'create.error.generic': 'Revisa los datos e inténtalo de nuevo.',
  'create.flatLimit':
    'Puedes crear hasta {max} pisos desde este dispositivo. Únete a un piso existente con su código de invitación.',

  // Install hint
  'install.text':
    'Instala Housely: toca Compartir y luego Añadir a pantalla de inicio. Si no, Safari puede borrar tus datos tras una semana sin abrirlo y podrías perder el acceso al piso.',
  'install.gotIt': 'Entendido',

  // Invite code
  'invite.label': 'Código de invitación',
  'invite.shareAria': 'Compartir el código',
  'invite.share': 'Compartir',
  'invite.message': 'Únete a nuestro piso en Housely con el código {code}: {url}',
  'invite.copied': 'Copiado: pégalo en tu chat.',
  'invite.manual': 'No se ha podido compartir desde aquí: envíalo a mano. {message}',

  // This week
  'week.title': 'Semana {n}',
  'week.zonesDone': '{done} de {total} zonas hechas esta semana',
  'week.progress': 'Progreso de la semana',
  'week.allClean': '¡Todo está limpio esta semana! Buen trabajo.',
  'week.done': 'Hecho {date}',
  'week.pending': 'Pendiente',
  'week.markDone': 'Marcar como hecho',
  'week.updateDate': 'Actualizar fecha',
  'week.resting': 'Libres esta semana: {names}',

  // People
  'people.title': 'Personas',
  'people.release': 'Liberar',
  'people.releaseAria': 'Liberar a {name}',
  'people.waiting': 'Esperando a que {name} se una',
  'people.confirm':
    '{name} perderá el acceso en su móvil actual y podrá volver a unirse con el código de invitación. Lo que ya limpió se conserva.',
  'people.confirmYes': 'Sí, liberar',

  // Tricount
  'tricount.open': 'Abrir Tricount',
  'tricount.notYet': 'Quien creó el piso aún no ha añadido el enlace de Tricount.',
  'tricount.edit': 'Editar enlace de Tricount',
  'tricount.add': 'Añadir enlace de Tricount',
  'tricount.label': 'Enlace de Tricount',
  'tricount.help': 'Déjalo vacío para quitar el enlace.',
  'tricount.not-https': 'El enlace debe empezar por https://',
  'tricount.not-tricount': 'Solo se permiten enlaces de tricount.com.',
  'tricount.too-long': 'El enlace es demasiado largo (300 caracteres como máximo).',

  // Flat screen
  'flat.leave': 'Salir de este piso en este dispositivo',
  'flat.unavailable': 'Este piso no está disponible. Puede que hayas perdido el acceso.',

  // Sign-in gate
  'auth.failed': 'No se ha podido iniciar sesión. Revisa tu conexión y recarga la página.',
}
