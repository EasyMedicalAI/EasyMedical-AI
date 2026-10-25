// Shared layout pieces, so the Records, Chatbot, and Settings screens match the Home screen.
import React from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { rowIconSize } from '@/components/rowIcons';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

// The app name bar and large page title, as on Home
// An optional round button at the right of the title, for the screen's main action
export function ScreenHeader({ title, action }: { title: string; action?: { label: string; onPress: () => void } }) {
  return (
    <>
      <View style={kit.topBar}>
        <View />
        <Text style={kit.appName}>EasyMedical AI</Text>
      </View>
      <View style={[kit.pageHeader, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
        <Text style={kit.pageTitle}>{title}</Text>
        {action && (
          <TouchableOpacity style={kit.headerAction} onPress={action.onPress} accessibilityLabel={action.label}>
            <MaterialCommunityIcons name="plus" size={22} color="#FFF" />
          </TouchableOpacity>
        )}
      </View>
    </>
  );
}

// A section with an 18pt title above its content
export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={kit.section}>
      <Text style={kit.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

// A white group of rows with hairline borders
export function ListCard({ children }: { children: React.ReactNode }) {
  return <View style={kit.listCard}>{children}</View>;
}

export function Divider() {
  return <View style={kit.divider} />;
}

// One row: icon, label, optional hint, value, and a chevron when it's tappable
export function ListRow({
  icon,
  label,
  hint,
  value,
  onPress,
  danger,
  badge,
}: {
  icon: IconName;
  label: string;
  hint?: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  badge?: React.ReactNode;
}) {
  const content = (
    <>
      <MaterialCommunityIcons
        name={icon}
        size={rowIconSize(icon)}
        color={danger ? '#FF3B30' : '#666'}
        style={kit.rowIcon}
      />
      <View style={kit.rowContent}>
        <View style={kit.labelRow}>
          <Text style={[kit.rowLabel, danger && kit.dangerText]}>{label}</Text>
          {badge}
        </View>
        {hint ? <Text style={kit.rowHint}>{hint}</Text> : null}
      </View>
      {value ? <Text style={kit.rowValue}>{value}</Text> : null}
      {onPress ? <MaterialCommunityIcons name="chevron-right" size={20} color="#C7C7CC" style={kit.rowChevron} /> : null}
    </>
  );
  return onPress ? (
    <TouchableOpacity style={kit.rowTouch} onPress={onPress}>
      {content}
    </TouchableOpacity>
  ) : (
    <View style={kit.rowTouch}>{content}</View>
  );
}

// A full-screen page that opens from a row, with ✕ at the top right
export function DetailPage({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={kit.detailModal}>
        <View style={kit.detailHeader}>
          <View />
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={kit.detailClose}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={kit.detailContent}>
          {title ? <Text style={kit.detailTitle}>{title}</Text> : null}
          {children}
        </ScrollView>
      </View>
    </Modal>
  );
}

const kit = StyleSheet.create({
  headerAction: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBar: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  appName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pageHeader: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginBottom: 12,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  listCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
  },
  rowTouch: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  rowIcon: {
    width: 22,
    marginRight: 12,
  },
  rowContent: {
    flex: 1,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  rowHint: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  rowValue: {
    fontSize: 15,
    color: '#000',
    marginLeft: 8,
  },
  rowChevron: {
    marginLeft: 8,
  },
  dangerText: {
    color: '#FF3B30',
  },
  detailModal: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  detailClose: {
    fontSize: 26,
    color: '#007AFF',
    fontWeight: '600',
  },
  detailContent: {
    paddingTop: 12,
    paddingBottom: 60,
  },
  detailTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
    marginBottom: 12,
    paddingHorizontal: 20,
  },
});
