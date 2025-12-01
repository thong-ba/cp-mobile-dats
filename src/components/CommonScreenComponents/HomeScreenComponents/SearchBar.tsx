import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { COLORS } from '../../../constants/color';

type Props = {
  value?: string;
  onChangeText?: (text: string) => void;
  onSubmitEditing?: () => void;
  isLoading?: boolean;
};

const SearchBar: React.FC<Props> = ({
  value,
  onChangeText,
  onSubmitEditing,
  isLoading = false,
}) => {
  const navigation = useNavigation();
  const suggestions = useMemo(
    () => ['JBL Party 200', 'Sony Sonic', 'LG King', 'Sony WH-1000XM5', 
        'JBL Flip 6', 'Shure MV7', 'Sony SRS-XB', 'Sony SRS-XB1000', 
        'Sony SRS-XB12', 'Sony SRS-XB13', 'Sony SRS-XB14', 'Sony SRS-XB15'],
    [],
  );
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setPlaceholderIndex((i) => (i + 1) % suggestions.length);
    }, 3000);
    return () => clearInterval(id);
  }, [suggestions.length]);

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.inputRow}>
          <MaterialCommunityIcons name="magnify" size={22} color={COLORS.gray} />
          <TextInput
            placeholder={`${suggestions[placeholderIndex]}...`}
            placeholderTextColor={COLORS.gray}
            style={styles.input}
            value={value}
            onChangeText={onChangeText}
            onSubmitEditing={() => onSubmitEditing?.()}
            returnKeyType="search"
          />
          {/* <TouchableOpacity activeOpacity={0.7}>
            <MaterialCommunityIcons name="camera-outline" size={22} color={COLORS.gray} />
          </TouchableOpacity> */}
        </View>
        <TouchableOpacity
          style={styles.actionIcon}
          activeOpacity={0.8}
          onPress={() => {
            // @ts-ignore - navigate to Cart
            navigation.navigate('Cart');
          }}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#FF6A00" />
          ) : (
            <MaterialCommunityIcons name="cart-outline" size={22} color={COLORS.white} />
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionIcon} activeOpacity={0.8}>
          <MaterialCommunityIcons name="message-text-outline" size={22} color={COLORS.white} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default SearchBar;

const styles = StyleSheet.create({
  container: {
    // backgroundColor: COLORS.white,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: 'rgba(248, 246, 246, 0.35)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  input: {
    flex: 1,
    paddingHorizontal: 8,
    height: 44,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,106,0,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,106,0,0.35)',
  },
});
