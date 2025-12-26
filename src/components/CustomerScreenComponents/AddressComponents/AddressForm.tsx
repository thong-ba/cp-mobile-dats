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
  postalCode: '70000', // Mã bưu điện mặc định
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

    if (!values.street.trim()) {
      setError('Vui lòng nhập tên đường.');
      return;
    }

    if (values.street.trim().length < 2) {
      setError('Tên đường phải có ít nhất 2 ký tự.');
      return;
    }

    if (values.postalCode && !validatePostalCode(values.postalCode)) {
      setError('Mã bưu điện phải là số có 5-6 chữ số.');
      return;
    }

    // Validate mã địa lý (theo tài liệu API) - kiểm tra cả selected và values để đảm bảo
    if (!selectedProvince || !values.provinceCode || values.provinceCode.trim() === '') {
      setError('Vui lòng chọn tỉnh/thành phố.');
      return;
    }

    if (!selectedDistrict || !values.districtId || values.districtId === 0) {
      setError('Vui lòng chọn quận/huyện.');
      return;
    }

    if (!selectedWard || !values.wardCode || values.wardCode.trim() === '') {
      setError('Vui lòng chọn phường/xã.');
      return;
    }

    // Auto-build addressLine if empty (theo tài liệu: có thể để trống, backend sẽ tự tạo)
    // Format: {street}, {ward}, {district}, {province}
    const finalAddressLine =
      values.addressLine.trim() ||
      `${values.street}, ${values.ward}, ${values.district}, ${values.province}`;

    const finalPayload: CreateCustomerAddressPayload = {
      ...values,
      addressLine: finalAddressLine,
      receiverName: values.receiverName.trim(),
      phoneNumber: values.phoneNumber.trim(),
      // Mã bưu điện mặc định là 70000 (ẩn khỏi UI)
      postalCode: '70000',
      // Đảm bảo note là null nếu trống
      note: values.note?.trim() || null,
    };

    console.log('[AddressForm] Submitting payload:', JSON.stringify(finalPayload, null, 2));
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

      {/* Mã bưu điện được ẩn, mặc định là 70000 */}

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
          Số nhà / Địa chỉ chi tiết
        </Text>
        <TextInput
          style={styles.input}
          value={values.addressLine}
          onChangeText={(text) => handleChange('addressLine', text)}
          placeholder="Số nhà, hẻm, tòa nhà... (để trống sẽ tự động tạo)"
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


