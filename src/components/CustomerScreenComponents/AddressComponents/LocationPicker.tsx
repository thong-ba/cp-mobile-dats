import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Menu } from 'react-native-paper';
import {
    District,
    getActiveDistricts,
    getActiveProvinces,
    getActiveWards,
    Province,
    Ward,
} from '../../../services/ghnService';

const ORANGE = '#FF6A00';

type LocationPickerProps = {
  selectedProvinceId: number | null;
  selectedDistrictId: number | null;
  selectedWardCode: string | null;
  onProvinceChange: (province: Province | null) => void;
  onDistrictChange: (district: District | null) => void;
  onWardChange: (ward: Ward | null) => void;
  initialProvinceName?: string;
  initialDistrictName?: string;
  initialWardName?: string;
};

const LocationPicker: React.FC<LocationPickerProps> = ({
  selectedProvinceId,
  selectedDistrictId,
  selectedWardCode,
  onProvinceChange,
  onDistrictChange,
  onWardChange,
  initialProvinceName,
  initialDistrictName,
  initialWardName,
}) => {
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);

  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingWards, setLoadingWards] = useState(false);

  const [provinceMenuVisible, setProvinceMenuVisible] = useState(false);
  const [districtMenuVisible, setDistrictMenuVisible] = useState(false);
  const [wardMenuVisible, setWardMenuVisible] = useState(false);

  const [selectedProvinceName, setSelectedProvinceName] = useState<string>(
    initialProvinceName || '',
  );
  const [selectedDistrictName, setSelectedDistrictName] = useState<string>(
    initialDistrictName || '',
  );
  const [selectedWardName, setSelectedWardName] = useState<string>(initialWardName || '');

  // Load provinces on mount
  useEffect(() => {
    const loadProvinces = async () => {
      try {
        setLoadingProvinces(true);
        const data = await getActiveProvinces();
        setProvinces(data);
      } catch (error) {
        console.error('[LocationPicker] Failed to load provinces:', error);
      } finally {
        setLoadingProvinces(false);
      }
    };
    loadProvinces();
  }, []);

  // Load districts when province is selected
  useEffect(() => {
    if (selectedProvinceId) {
      const loadDistricts = async () => {
        try {
          setLoadingDistricts(true);
          setDistricts([]);
          setWards([]);
          onDistrictChange(null);
          onWardChange(null);
          setSelectedDistrictName('');
          setSelectedWardName('');

          const data = await getActiveDistricts(selectedProvinceId);
          setDistricts(data);
        } catch (error) {
          console.error('[LocationPicker] Failed to load districts:', error);
        } finally {
          setLoadingDistricts(false);
        }
      };
      loadDistricts();
    } else {
      setDistricts([]);
      setWards([]);
    }
  }, [selectedProvinceId]);

  // Load wards when district is selected
  useEffect(() => {
    if (selectedDistrictId) {
      const loadWards = async () => {
        try {
          setLoadingWards(true);
          setWards([]);
          onWardChange(null);
          setSelectedWardName('');

          const data = await getActiveWards(selectedDistrictId);
          setWards(data);
        } catch (error) {
          console.error('[LocationPicker] Failed to load wards:', error);
        } finally {
          setLoadingWards(false);
        }
      };
      loadWards();
    } else {
      setWards([]);
    }
  }, [selectedDistrictId]);

  const handleProvinceSelect = (province: Province) => {
    setSelectedProvinceName(province.ProvinceName);
    onProvinceChange(province);
    setProvinceMenuVisible(false);
  };

  const handleDistrictSelect = (district: District) => {
    setSelectedDistrictName(district.DistrictName);
    onDistrictChange(district);
    setDistrictMenuVisible(false);
  };

  const handleWardSelect = (ward: Ward) => {
    setSelectedWardName(ward.WardName);
    onWardChange(ward);
    setWardMenuVisible(false);
  };

  return (
    <>
      {/* Province Picker */}
      <View style={styles.field}>
        <Text style={styles.label}>
          Tỉnh / Thành phố <Text style={styles.required}>*</Text>
        </Text>
        <Menu
          visible={provinceMenuVisible}
          onDismiss={() => setProvinceMenuVisible(false)}
          anchor={
            <TouchableOpacity
              style={styles.picker}
              onPress={() => setProvinceMenuVisible(true)}
              disabled={loadingProvinces}
            >
              {loadingProvinces ? (
                <ActivityIndicator size="small" color={ORANGE} />
              ) : (
                <Text style={[styles.pickerText, !selectedProvinceName && styles.placeholder]}>
                  {selectedProvinceName || 'Chọn tỉnh/thành phố'}
                </Text>
              )}
            </TouchableOpacity>
          }
        >
          {provinces.map((province) => (
            <Menu.Item
              key={province.ProvinceID}
              onPress={() => handleProvinceSelect(province)}
              title={province.ProvinceName}
            />
          ))}
        </Menu>
      </View>

      {/* District Picker */}
      <View style={styles.field}>
        <Text style={styles.label}>
          Quận / Huyện <Text style={styles.required}>*</Text>
        </Text>
        <Menu
          visible={districtMenuVisible}
          onDismiss={() => setDistrictMenuVisible(false)}
          anchor={
            <TouchableOpacity
              style={[
                styles.picker,
                (!selectedProvinceId || loadingDistricts) && styles.pickerDisabled,
              ]}
              onPress={() => {
                if (selectedProvinceId && !loadingDistricts) {
                  setDistrictMenuVisible(true);
                }
              }}
              disabled={!selectedProvinceId || loadingDistricts}
            >
              {loadingDistricts ? (
                <ActivityIndicator size="small" color={ORANGE} />
              ) : (
                <Text style={[styles.pickerText, !selectedDistrictName && styles.placeholder]}>
                  {selectedDistrictName || 'Chọn quận/huyện'}
                </Text>
              )}
            </TouchableOpacity>
          }
        >
          {districts.map((district) => (
            <Menu.Item
              key={district.DistrictID}
              onPress={() => handleDistrictSelect(district)}
              title={district.DistrictName}
            />
          ))}
        </Menu>
      </View>

      {/* Ward Picker */}
      <View style={styles.field}>
        <Text style={styles.label}>
          Phường / Xã <Text style={styles.required}>*</Text>
        </Text>
        <Menu
          visible={wardMenuVisible}
          onDismiss={() => setWardMenuVisible(false)}
          anchor={
            <TouchableOpacity
              style={[
                styles.picker,
                (!selectedDistrictId || loadingWards) && styles.pickerDisabled,
              ]}
              onPress={() => {
                if (selectedDistrictId && !loadingWards) {
                  setWardMenuVisible(true);
                }
              }}
              disabled={!selectedDistrictId || loadingWards}
            >
              {loadingWards ? (
                <ActivityIndicator size="small" color={ORANGE} />
              ) : (
                <Text style={[styles.pickerText, !selectedWardName && styles.placeholder]}>
                  {selectedWardName || 'Chọn phường/xã'}
                </Text>
              )}
            </TouchableOpacity>
          }
        >
          {wards.map((ward) => (
            <Menu.Item
              key={ward.WardCode}
              onPress={() => handleWardSelect(ward)}
              title={ward.WardName}
            />
          ))}
        </Menu>
      </View>
    </>
  );
};

export default LocationPicker;

const styles = StyleSheet.create({
  field: {
    marginBottom: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#444',
    marginBottom: 6,
  },
  required: {
    color: '#B3261E',
  },
  picker: {
    height: 44,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
  },
  pickerDisabled: {
    backgroundColor: '#F5F5F5',
    opacity: 0.6,
  },
  pickerText: {
    fontSize: 16,
    color: '#222',
  },
  placeholder: {
    color: '#999',
  },
});

