import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Card, Chip } from 'react-native-paper';
import { CustomerAddress } from '../../../types/customer';

const ORANGE = '#FF6A00';

type Props = {
  addresses: CustomerAddress[];
  onPressAddress?: (address: CustomerAddress) => void;
  onDeleteAddress?: (address: CustomerAddress) => void;
  onSetDefaultAddress?: (address: CustomerAddress) => void;
};

const AddressList: React.FC<Props> = ({
  addresses,
  onPressAddress,
  onDeleteAddress,
  onSetDefaultAddress,
}) => {
  const renderItem = ({ item }: { item: CustomerAddress }) => {
    const fullAddress = `${item.addressLine}, ${item.street}, ${item.ward}, ${item.district}, ${item.province}, ${item.country}`;
    const labelMap: Record<string, string> = {
      HOME: 'Nhà riêng',
      WORK: 'Cơ quan',
      OTHER: 'Khác',
    };

    return (
      <Card style={styles.card} mode="elevated">
        <Card.Content>
          <View style={styles.row}>
            <TouchableOpacity
              style={{ flex: 1 }}
              onPress={() => onPressAddress?.(item)}
              activeOpacity={0.7}
            >
              <View style={styles.nameRow}>
                <Text style={styles.receiver}>{item.receiverName}</Text>
                {item.default && <Chip compact style={styles.defaultChip}>Mặc định</Chip>}
              </View>
              <Text style={styles.phone}>{item.phoneNumber}</Text>
              <Text style={styles.address} numberOfLines={2}>
                {fullAddress}
              </Text>
              {item.note && (
                <Text style={styles.note} numberOfLines={1}>
                  Ghi chú: {item.note}
                </Text>
              )}
            </TouchableOpacity>
            <View style={styles.rightSection}>
              <Chip compact style={styles.labelChip}>
                {labelMap[item.label] ?? item.label}
              </Chip>
              <View style={styles.actionButtons}>
                {!item.default && onSetDefaultAddress && (
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => onSetDefaultAddress(item)}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons name="star-outline" size={18} color={ORANGE} />
                  </TouchableOpacity>
                )}
                {onDeleteAddress && (
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => onDeleteAddress(item)}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons name="delete-outline" size={18} color="#B3261E" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </Card.Content>
      </Card>
    );
  };

  if (addresses.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>Chưa có địa chỉ giao hàng</Text>
        <Text style={styles.emptySubtitle}>
          Hãy thêm ít nhất một địa chỉ để đặt hàng nhanh hơn.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={addresses}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      contentContainerStyle={styles.listContent}
    />
  );
};

export default AddressList;

const styles = StyleSheet.create({
  listContent: {
    padding: 16,
    paddingBottom: 32,
    gap: 12,
  },
  card: {
    borderRadius: 16,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  receiver: {
    fontSize: 16,
    fontWeight: '700',
    color: '#222',
  },
  phone: {
    fontSize: 14,
    color: '#444',
    marginBottom: 4,
  },
  address: {
    fontSize: 13,
    color: '#555',
  },
  note: {
    marginTop: 4,
    fontSize: 12,
    color: '#777',
  },
  defaultChip: {
    backgroundColor: '#FFEFE6',
  },
  labelChip: {
    alignSelf: 'flex-start',
    backgroundColor: '#F2F2F2',
    marginBottom: 8,
  },
  rightSection: {
    alignItems: 'flex-end',
    gap: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
  },
  emptyContainer: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#222',
    marginBottom: 8,
  },
  emptySubtitle: {
    textAlign: 'center',
    color: '#555',
  },
});


