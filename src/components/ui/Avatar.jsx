import { colors, font } from '../../styles/tokens.js';

export default function Avatar({ member, size = 36, isActive = false }) {
  const initial = (member?.name ?? '?')[0].toUpperCase();

  if (member?.avatarData) {
    return (
      <img
        src={member.avatarData}
        alt={member?.name ?? ''}
        style={{
          width:        size,
          height:       size,
          borderRadius: '50%',
          objectFit:    'cover',
          flexShrink:   0,
          display:      'block',
        }}
      />
    );
  }

  return (
    <div style={{
      width:          size,
      height:         size,
      borderRadius:   '50%',
      background:     isActive ? colors.accent : colors.cardSecondary,
      color:          isActive ? '#fff'        : colors.textSecondary,
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      fontSize:       Math.round(size * 0.38),
      fontWeight:     700,
      fontFamily:     font.sans,
      flexShrink:     0,
    }}>
      {initial}
    </div>
  );
}
