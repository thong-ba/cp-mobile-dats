import React, { useEffect, useState } from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { HelperText, Switch } from 'react-native-paper';
import type { District, Province, Ward } from '../../../services/ghnService';
import { CreateCustomerAddressPayload } from '../../../types/customer';
import LocationPicker from './LocationPicker';

type AddressFormProps = {
  onSubmit: (payload: CreateCustomerAddressPayload) => void | Promise<void>;
  isSubmitting?: boolean;
  initialValues?: CreateCustomerAddressPayload;
};

const ORANGE = '#FF6A00';

const defaultValues: CreateCustomerAddressPayload = {
  receiverName: '',
  phoneNumber: '',
  label: 'HOME',
  country: 'Việt Nam',
  province: '',
  district: '',
  ward: '',
  street: '',
  addressLine: '',
  postalCode: '',
  note: null,
  provinceCode: '',
  districtId: 0,
  wardCode: '',
  lat: null,
  lng: null,
  isDefault: false,
};

const AddressForm: React.FC<AddressFormProps> = ({
  onSubmit,
  isSubmitting = false,
  initialValues,
}) => {
  const [values, setValues] = useState<CreateCustomerAddressPayload>(
    initialValues ?? defaultValues,
  );
  const [error, setError] = useState<string | null>(null);

  // Location picker states
  const [selectedProvince, setSelectedProvince] = useState<Province | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<District | null>(null);
  const [selectedWard, setSelectedWard] = useState<Ward | null>(null);

  // Initialize location picker from initialValues if editing
  useEffect(() => {
    if (initialValues) {
      // Try to find province by name or code
      // Note: We'll need to load provinces first, but for now just set the names
      // The LocationPicker will handle loading and matching
    }
  }, [initialValues]);

  const handleChange = (field: keyof CreateCustomerAddressPayload, value: string) => {
    setValues((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Validation functions
  const validatePhoneNumber = (phone: string): boolean => {
    const phoneRegex = /^(0|\+84)[0-9]{9,10}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
  };

  const validatePostalCode = (code: string): boolean => {
    if (!code.trim()) return true; // Optional
    return /^\d{5,6}$/.test(code);
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;

    // Validate required fields
    if (!values.receiverName.trim()) {
      setError('Vui lòng nhập tên người nhận.');
      return;
    }

    if (values.receiverName.trim().length < 2 || values.receiverName.trim().length > 100) {
      setError('Tên người nhận phải từ 2 đến 100 ký tự.');
      return;
    }

    if (!values.phoneNumber.trim()) {
      setError('Vui lòng nhập số điện thoại.');
      return;
    }

    if (!validatePhoneNumber(values.phoneNumber)) {
      setError('Số điện thoại không hợp lệ. Vui lòng nhập số điện thoại Việt Nam (10-11 chữ số, bắt đầu bằng 0 hoặc +84).');
      return;
    }

    if (!selectedProvince || !values.provinceCode) {
      setError('Vui lòng chọn tỉnh/thành phố.');
      return;
    }

    if (!selectedDistrict || !values.districtId || values.districtId === 0) {
      setError('Vui lòng chọn quận/huyện.');
      return;
    }

    if (!selectedWard || !values.wardCode) {
      setError('Vui lòng chọn phường/xã.');
      return;
    }

    if (!values.street.trim()) {
      setError('Vui lòng nhập tên đường.');
      return;
    }

    if (values.street.trim().length < 2) {
      setError('Tên đường phải có ít nhất 2 ký tự.');
      return;
    }

    if (!values.addressLine.trim()) {
      setError('Vui lòng nhập số nhà/địa chỉ chi tiết.');
      return;
    }

    if (values.addressLine.trim().length < 5) {
      setError('Số nhà/địa chỉ phải có ít nhất 5 ký tự.');
      return;
    }

    if (values.postalCode && !validatePostalCode(values.postalCode)) {
      setError('Mã bưu điện phải là số có 5-6 chữ số.');
      return;
    }

    // Auto-build addressLine if empty
    const finalAddressLine =
      values.addressLine.trim() ||
      `${values.street}, ${values.ward}, ${values.district}, ${values.province}`;

    const finalPayload: CreateCustomerAddressPayload = {
      ...values,
      addressLine: finalAddressLine,
      receiverName: values.receiverName.trim(),
      phoneNumber: values.phoneNumber.trim(),
    };

    setError(null);
    await onSubmit(finalPayload);
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {error && <HelperText type="error" visible style={styles.errorText}>{error}</HelperText>}

      <View style={styles.field}>
        <Text style={styles.label}>
          Tên người nhận <Text style={styles.required}>*</Text>
        </Text>
        <TextInput
          style={styles.input}
          value={values.receiverName}
          onChangeText={(text) => handleChange('receiverName', text)}
          placeholder="Nguyễn Văn A"
          maxLength={100}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>
          Số điện thoại <Text style={styles.required}>*</Text>
        </Text>
        <TextInput
          style={styles.input}
          value={values.phoneNumber}
          onChangeText={(text) => handleChange('phoneNumber', text)}
          keyboardType="phone-pad"
          placeholder="0908123456 hoặc +84908123456"
          maxLength={13}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Quốc gia</Text>
        <TextInput
          style={[styles.input, { backgroundColor: '#F5F5F5' }]}
          value={values.country}
          editable={false}
        />
      </View>

      <LocationPicker
        selectedProvinceId={selectedProvince?.ProvinceID ?? null}
        selectedDistrictId={selectedDistrict?.DistrictID ?? null}
        selectedWardCode={selectedWard?.WardCode ?? null}
        onProvinceChange={(province) => {
          setSelectedProvince(province);
          if (province) {
            setValues((prev) => ({
              ...prev,
              province: province.ProvinceName,
              provinceCode: String(province.ProvinceID),
            }));
          } else {
            setValues((prev) => ({
              ...prev,
              province: '',
              provinceCode: '',
              district: '',
              districtId: 0,
              ward: '',
              wardCode: '',
            }));
          }
        }}
        onDistrictChange={(district) => {
          setSelectedDistrict(district);
          if (district) {
            setValues((prev) => ({
              ...prev,
              district: district.DistrictName,
              districtId: district.DistrictID,
            }));
          } else {
            setValues((prev) => ({
              ...prev,
              district: '',
              districtId: 0,
              ward: '',
              wardCode: '',
            }));
          }
        }}
        onWardChange={(ward) => {
          setSelectedWard(ward);
          if (ward) {
            setValues((prev) => ({
              ...prev,
              ward: ward.WardName,
              wardCode: ward.WardCode,
            }));
          } else {
            setValues((prev) => ({
              ...prev,
              ward: '',
              wardCode: '',
            }));
          }
        }}
        initialProvinceName={initialValues?.province}
        initialDistrictName={initialValues?.district}
        initialWardName={initialValues?.ward}
      />

      <View style={styles.row}>
        <View style={[styles.field, styles.col]}>
          <Text style={styles.label}>Mã bưu điện</Text>
          <TextInput
            style={styles.input}
            value={values.postalCode}
            onChangeText={(text) => handleChange('postalCode', text)}
            placeholder="5-6 chữ số"
            keyboardType="numeric"
            maxLength={6}
          />
        </View>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>
          Đường <Text style={styles.required}>*</Text>
        </Text>
        <TextInput
          style={styles.input}
          value={values.street}
          onChangeText={(text) => handleChange('street', text)}
          placeholder="Tên đường"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>
          Số nhà / Địa chỉ <Text style={styles.required}>*</Text>
        </Text>
        <TextInput
          style={styles.input}
          value={values.addressLine}
          onChangeText={(text) => handleChange('addressLine', text)}
          placeholder="Số nhà, hẻm, tòa nhà..."
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Ghi chú</Text>
        <TextInput
          style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
          multiline
          value={values.note ?? ''}
          onChangeText={(text) => setValues((prev) => ({ ...prev, note: text || null }))}
          placeholder="Ghi chú thêm cho shipper..."
        />
      </View>

      <View style={[styles.field, styles.switchRow]}>
        <Text style={styles.label}>Đặt làm địa chỉ mặc định</Text>
        <Switch
          value={values.isDefault}
          onValueChange={(checked) =>
            setValues((prev) => ({
              ...prev,
              isDefault: checked,
            }))
          }
          color={ORANGE}
        />
      </View>

      <TouchableOpacity
        style={[styles.submitButton, isSubmitting && { opacity: 0.6 }]}
        onPress={handleSubmit}
        activeOpacity={isSubmitting ? 1 : 0.8}
      >
        <Text style={styles.submitText}>{isSubmitting ? 'Đang lưu...' : 'Lưu địa chỉ'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

export default AddressForm;

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 32,
    gap: 12,
  },
  field: {
    marginBottom: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#444',
    marginBottom: 6,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  col: {
    flex: 1,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  submitButton: {
    marginTop: 16,
    height: 48,
    borderRadius: 12,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  errorText: {
    marginBottom: 8,
  },
  required: {
    color: '#B3261E',
  },
});


