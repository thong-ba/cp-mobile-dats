import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CartItem } from '../../../types/cart';

const ORANGE = '#FF6A00';

type ShopVoucherFromAPI = {
  shopVoucherId?: string;
  voucherId?: string;
  code: string;
  title?: string;
  name?: string;
  type?: 'PERCENT' | 'FIXED';
  discountPercent?: number | null;
  discountValue?: number | null;
  maxDiscountValue?: number | null;
  minOrderValue?: number | null;
  [key: string]: unknown;
};

type StoreGroup = {
  storeId: string;
  storeName: string;
  items: CartItem[];
};

type SelectedVoucher = {
  shopVoucherId: string;
  code: string;
};

type Props = {
  items: CartItem[];
  storeGroups?: StoreGroup[];
  storeVouchers?: Map<string, ShopVoucherFromAPI[]>;
  productVouchers?: Map<string, ShopVoucherFromAPI[]>;
  selectedShopVouchers?: Map<string, SelectedVoucher>;
  selectedProductVouchers?: Map<string, SelectedVoucher>;
  onCartChange?: () => void;
  onRemoveItem?: (cartItemId: string) => void;
  onQuantityChange?: (cartItemId: string, quantity: number) => void;
  onSelectShopVoucher?: (storeId: string, shopVoucherId: string | null, code: string) => void;
  onSelectProductVoucher?: (cartItemId: string, shopVoucherId: string | null, code: string) => void;
};

const formatCurrencyVND = (value: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);

const CartItemList: React.FC<Props> = ({
  items,
  storeGroups,
  storeVouchers = new Map(),
  productVouchers = new Map(),
  selectedShopVouchers = new Map(),
  selectedProductVouchers = new Map(),
  onCartChange,
  onRemoveItem,
  onQuantityChange,
  onSelectShopVoucher,
  onSelectProductVoucher,
}) => {
  const [shopVoucherModal, setShopVoucherModal] = useState<{ storeId: string; visible: boolean }>({
    storeId: '',
    visible: false,
  });
  const [productVoucherModal, setProductVoucherModal] = useState<{
    cartItemId: string;
    visible: boolean;
  }>({
    cartItemId: '',
    visible: false,
  });

  const getPriceDisplay = (item: CartItem) => {
    // Quy tắc hiển thị giá theo API documentation:
    // 1. Nếu inPlatformCampaign = true và platformCampaignPrice != null và campaignUsageExceeded != true:
    //    -> Giá bán = platformCampaignPrice, Giá gạch = baseUnitPrice
    // 2. Nếu campaignUsageExceeded = true:
    //    -> Badge "Hết lượt ưu đãi", không dùng platformCampaignPrice
    // 3. Nếu không có campaign:
    //    -> Giá bán = unitPrice
    
    const hasActiveCampaign =
      item.inPlatformCampaign === true &&
      item.platformCampaignPrice !== null &&
      item.platformCampaignPrice !== undefined &&
      item.campaignUsageExceeded !== true;

    if (hasActiveCampaign) {
      return {
        priceDisplay: item.platformCampaignPrice!,
        originalPrice: item.baseUnitPrice ?? item.unitPrice,
        hasDiscount: true,
        hasPlatformPrice: true,
        campaignUsageExceeded: false,
      };
    }

    // Nếu campaignUsageExceeded = true hoặc không có campaign
    return {
      priceDisplay: item.unitPrice,
      originalPrice: item.baseUnitPrice ?? null,
      hasDiscount: false,
      hasPlatformPrice: false,
      campaignUsageExceeded: item.campaignUsageExceeded === true,
    };
  };

  const handleQuantityChange = (cartItemId: string, newQuantity: number) => {
    const clamped = Math.max(1, Math.min(newQuantity, 99));
    if (onQuantityChange) {
      onQuantityChange(cartItemId, clamped);
    } else {
      console.log('Update quantity', cartItemId, clamped);
      onCartChange?.();
    }
  };

  const handleRemoveItem = (cartItemId: string) => {
    if (onRemoveItem) {
      onRemoveItem(cartItemId);
    } else {
      console.log('Remove item', cartItemId);
      onCartChange?.();
    }
  };

  const getVoucherDisplayText = (voucher: ShopVoucherFromAPI) => {
    // Logic: Nếu có discountPercent → PERCENT, nếu có discountValue → FIXED
    // API response không có field 'type', chỉ có discountPercent và discountValue
    if (voucher.discountPercent !== null && voucher.discountPercent !== undefined && voucher.discountPercent > 0) {
      return `-${voucher.discountPercent}%`;
    } else if (voucher.discountValue !== null && voucher.discountValue !== undefined && voucher.discountValue > 0) {
      return `-${formatCurrencyVND(voucher.discountValue)}`;
    }
    return voucher.title || voucher.name || voucher.code;
  };

  // Nếu có storeGroups, hiển thị theo groups; ngược lại hiển thị flat list
  const displayItems = storeGroups && storeGroups.length > 0 ? storeGroups : null;

  if (displayItems) {
    // Hiển thị theo store groups
    return (
      <View style={styles.container}>
        {displayItems.map((group) => {
          const shopVouchers = storeVouchers.get(group.storeId) || [];
          const selectedShopVoucher = selectedShopVouchers.get(group.storeId);
          const selectedVoucher = selectedShopVoucher
            ? shopVouchers.find(
                (v: ShopVoucherFromAPI) => (v.shopVoucherId || v.voucherId) === selectedShopVoucher.shopVoucherId,
              )
            : null;

          return (
            <View key={group.storeId} style={styles.storeGroup}>
              {/* Store Header */}
              <View style={styles.storeHeader}>
                <View style={styles.storeHeaderLeft}>
                  <MaterialCommunityIcons name="store" size={20} color={ORANGE} />
                  <Text style={styles.storeName}>{group.storeName}</Text>
                </View>
                {shopVouchers.length > 0 && (
                  <TouchableOpacity
                    style={styles.voucherButton}
                    onPress={() => setShopVoucherModal({ storeId: group.storeId, visible: true })}
                  >
                    <MaterialCommunityIcons name="ticket-percent" size={18} color={ORANGE} />
                    <Text style={styles.voucherButtonText}>
                      {selectedVoucher
                        ? getVoucherDisplayText(selectedVoucher)
                        : 'Chọn voucher'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Store Items */}
              {group.items.map((item) => {
                const itemVouchers = productVouchers.get(item.cartItemId) || [];
                const selectedItemVoucher = selectedProductVouchers.get(item.cartItemId);
                const selectedItemVoucherData = selectedItemVoucher
                  ? itemVouchers.find(
                      (v: ShopVoucherFromAPI) =>
                        (v.shopVoucherId || v.voucherId) === selectedItemVoucher.shopVoucherId,
                    )
                  : null;

                const { priceDisplay, originalPrice, hasDiscount, hasPlatformPrice, campaignUsageExceeded } =
                  getPriceDisplay(item);
                const hasActiveCampaign = hasPlatformPrice && hasDiscount;

                return (
                  <View key={item.cartItemId} style={styles.itemCard}>
                    <Image
                      source={{ uri: item.image }}
                      style={styles.itemImage}
                      resizeMode="contain"
                    />
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName} numberOfLines={2}>
                        {item.name}
                      </Text>
                      {item.variantOptionName && item.variantOptionValue && (
                        <Text style={styles.variantText}>
                          {item.variantOptionName}: {item.variantOptionValue}
                        </Text>
                      )}

                      {/* Product Voucher Button */}
                      {itemVouchers.length > 0 && (
                        <TouchableOpacity
                          style={styles.productVoucherButton}
                          onPress={() =>
                            setProductVoucherModal({ cartItemId: item.cartItemId, visible: true })
                          }
                        >
                          <MaterialCommunityIcons name="ticket-percent" size={16} color={ORANGE} />
                          <Text style={styles.productVoucherButtonText}>
                            {selectedItemVoucherData
                              ? getVoucherDisplayText(selectedItemVoucherData)
                              : 'Chọn voucher sản phẩm'}
                          </Text>
                        </TouchableOpacity>
                      )}

                      <View style={styles.priceBlock}>
                        {hasActiveCampaign ? (
                          <>
                            <Text style={styles.itemPrice}>
                              {formatCurrencyVND(priceDisplay)}
                            </Text>
                            {originalPrice && originalPrice > priceDisplay && (
                              <Text style={styles.originalPrice}>
                                {formatCurrencyVND(originalPrice)}
                              </Text>
                            )}
                            <View style={styles.badge}>
                              <Text style={styles.badgeText}>Campaign</Text>
                            </View>
                          </>
                        ) : (
                          <Text style={styles.itemPrice}>{formatCurrencyVND(priceDisplay)}</Text>
                        )}
                        {campaignUsageExceeded && (
                          <View style={[styles.badge, styles.badgeExpired]}>
                            <Text style={styles.badgeText}>Hết lượt ưu đãi</Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.quantityRow}>
                        <View style={styles.quantityControls}>
                          <TouchableOpacity
                            style={styles.quantityButton}
                            onPress={() => {
                              if (item.quantity > 1) {
                                handleQuantityChange(item.cartItemId, item.quantity - 1);
                              }
                            }}
                            disabled={item.quantity <= 1}
                          >
                            <MaterialCommunityIcons
                              name="minus"
                              size={18}
                              color={item.quantity <= 1 ? '#CCCCCC' : ORANGE}
                            />
                          </TouchableOpacity>
                          <Text style={styles.quantityText}>{item.quantity}</Text>
                          <TouchableOpacity
                            style={styles.quantityButton}
                            onPress={() => handleQuantityChange(item.cartItemId, item.quantity + 1)}
                          >
                            <MaterialCommunityIcons name="plus" size={18} color={ORANGE} />
                          </TouchableOpacity>
                        </View>
                        <TouchableOpacity
                          style={styles.removeButton}
                          onPress={() => handleRemoveItem(item.cartItemId)}
                        >
                          <MaterialCommunityIcons name="delete-outline" size={20} color="#B3261E" />
                        </TouchableOpacity>
                      </View>
                      <View style={styles.lineTotalRow}>
                        <Text style={styles.lineTotalLabel}>Thành tiền:</Text>
                        <Text style={styles.lineTotalValue}>
                          {formatCurrencyVND(item.lineTotal)}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          );
        })}

        {/* Shop Voucher Modal */}
        <Modal
          visible={shopVoucherModal.visible}
          transparent
          animationType="slide"
          onRequestClose={() => setShopVoucherModal({ storeId: '', visible: false })}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Chọn voucher cửa hàng</Text>
                <TouchableOpacity
                  onPress={() => setShopVoucherModal({ storeId: '', visible: false })}
                >
                  <MaterialCommunityIcons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalScrollView}>
                <TouchableOpacity
                  style={styles.voucherOption}
                  onPress={() => {
                    if (onSelectShopVoucher) {
                      onSelectShopVoucher(shopVoucherModal.storeId, null, '');
                    }
                    setShopVoucherModal({ storeId: '', visible: false });
                  }}
                >
                  <Text style={styles.voucherOptionText}>Không chọn voucher</Text>
                </TouchableOpacity>
                {(storeVouchers.get(shopVoucherModal.storeId) || []).map((voucher: ShopVoucherFromAPI) => {
                  const voucherId = voucher.shopVoucherId || voucher.voucherId || '';
                  const isSelected =
                    selectedShopVouchers.get(shopVoucherModal.storeId)?.shopVoucherId === voucherId;
                  return (
                    <TouchableOpacity
                      key={voucherId}
                      style={[styles.voucherOption, isSelected && styles.voucherOptionSelected]}
                      onPress={() => {
                        if (onSelectShopVoucher) {
                          onSelectShopVoucher(shopVoucherModal.storeId, voucherId, voucher.code);
                        }
                        setShopVoucherModal({ storeId: '', visible: false });
                      }}
                    >
                      <Text style={styles.voucherOptionText}>
                        {voucher.title || voucher.name || voucher.code}
                      </Text>
                      <Text style={styles.voucherOptionDiscount}>
                        {getVoucherDisplayText(voucher)}
                      </Text>
                      {isSelected && (
                        <MaterialCommunityIcons name="check-circle" size={20} color={ORANGE} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Product Voucher Modal */}
        <Modal
          visible={productVoucherModal.visible}
          transparent
          animationType="slide"
          onRequestClose={() => setProductVoucherModal({ cartItemId: '', visible: false })}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Chọn voucher sản phẩm</Text>
                <TouchableOpacity
                  onPress={() => setProductVoucherModal({ cartItemId: '', visible: false })}
                >
                  <MaterialCommunityIcons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalScrollView}>
                <TouchableOpacity
                  style={styles.voucherOption}
                  onPress={() => {
                    if (onSelectProductVoucher) {
                      onSelectProductVoucher(productVoucherModal.cartItemId, null, '');
                    }
                    setProductVoucherModal({ cartItemId: '', visible: false });
                  }}
                >
                  <Text style={styles.voucherOptionText}>Không chọn voucher</Text>
                </TouchableOpacity>
                {(productVouchers.get(productVoucherModal.cartItemId) || []).map((voucher: ShopVoucherFromAPI) => {
                  const voucherId = voucher.shopVoucherId || voucher.voucherId || '';
                  const isSelected =
                    selectedProductVouchers.get(productVoucherModal.cartItemId)?.shopVoucherId ===
                    voucherId;
                  return (
                    <TouchableOpacity
                      key={voucherId}
                      style={[styles.voucherOption, isSelected && styles.voucherOptionSelected]}
                      onPress={() => {
                        if (onSelectProductVoucher) {
                          onSelectProductVoucher(
                            productVoucherModal.cartItemId,
                            voucherId,
                            voucher.code,
                          );
                        }
                        setProductVoucherModal({ cartItemId: '', visible: false });
                      }}
                    >
                      <Text style={styles.voucherOptionText}>
                        {voucher.title || voucher.name || voucher.code}
                      </Text>
                      <Text style={styles.voucherOptionDiscount}>
                        {getVoucherDisplayText(voucher)}
                      </Text>
                      {isSelected && (
                        <MaterialCommunityIcons name="check-circle" size={20} color={ORANGE} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // Fallback: hiển thị flat list nếu không có storeGroups
  return (
    <View style={styles.container}>
      {items.map((item) => {
        const { priceDisplay, originalPrice, hasDiscount, hasPlatformPrice, campaignUsageExceeded } = getPriceDisplay(item);
        const hasActiveCampaign = hasPlatformPrice && hasDiscount;

        return (
          <View key={item.cartItemId} style={styles.itemCard}>
            <Image source={{ uri: item.image }} style={styles.itemImage} resizeMode="contain" />
            <View style={styles.itemInfo}>
              <Text style={styles.itemName} numberOfLines={2}>
                {item.name}
              </Text>
              {item.variantOptionName && item.variantOptionValue && (
                <Text style={styles.variantText}>
                  {item.variantOptionName}: {item.variantOptionValue}
                </Text>
              )}
              <View style={styles.priceBlock}>
                {hasActiveCampaign ? (
                  <>
                    <Text style={styles.itemPrice}>
                      {formatCurrencyVND(priceDisplay)}
                    </Text>
                    {originalPrice && originalPrice > priceDisplay && (
                      <Text style={styles.originalPrice}>
                        {formatCurrencyVND(originalPrice)}
                      </Text>
                    )}
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>Campaign</Text>
                    </View>
                  </>
                ) : (
                  <Text style={styles.itemPrice}>{formatCurrencyVND(priceDisplay)}</Text>
                )}
                {campaignUsageExceeded && (
                  <View style={[styles.badge, styles.badgeExpired]}>
                    <Text style={styles.badgeText}>Hết lượt ưu đãi</Text>
                  </View>
                )}
              </View>

              <View style={styles.quantityRow}>
                <View style={styles.quantityControls}>
                  <TouchableOpacity
                    style={styles.quantityButton}
                    onPress={() => {
                      if (item.quantity > 1) {
                        handleQuantityChange(item.cartItemId, item.quantity - 1);
                      }
                    }}
                    disabled={item.quantity <= 1}
                  >
                    <MaterialCommunityIcons
                      name="minus"
                      size={18}
                      color={item.quantity <= 1 ? '#CCCCCC' : ORANGE}
                    />
                  </TouchableOpacity>
                  <Text style={styles.quantityText}>{item.quantity}</Text>
                  <TouchableOpacity
                    style={styles.quantityButton}
                    onPress={() => handleQuantityChange(item.cartItemId, item.quantity + 1)}
                  >
                    <MaterialCommunityIcons name="plus" size={18} color={ORANGE} />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => handleRemoveItem(item.cartItemId)}
                >
                  <MaterialCommunityIcons name="delete-outline" size={20} color="#B3261E" />
                </TouchableOpacity>
              </View>
              <View style={styles.lineTotalRow}>
                <Text style={styles.lineTotalLabel}>Thành tiền:</Text>
                <Text style={styles.lineTotalValue}>{formatCurrencyVND(item.lineTotal)}</Text>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
};

export default CartItemList;

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 12,
  },
  storeGroup: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  storeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  storeHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  storeName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#222',
  },
  voucherButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FFF3EB',
    borderWidth: 1,
    borderColor: ORANGE,
  },
  voucherButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: ORANGE,
  },
  productVoucherButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#F0F0F0',
  },
  productVoucherButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: ORANGE,
  },
  itemCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  itemImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
  },
  itemInfo: {
    flex: 1,
    gap: 6,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222',
  },
  variantText: {
    fontSize: 13,
    color: '#666',
  },
  itemPrice: {
    fontSize: 14,
    color: ORANGE,
    fontWeight: '700',
  },
  discountPrice: {
    color: '#D32F2F',
  },
  originalPrice: {
    marginTop: 2,
    fontSize: 12,
    color: '#888',
    textDecorationLine: 'line-through',
  },
  priceBlock: {
    marginTop: 4,
    gap: 2,
  },
  badge: {
    alignSelf: 'flex-start',
    marginTop: 4,
    backgroundColor: '#FF7043',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  badgeExpired: {
    backgroundColor: '#9E9E9E',
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  quantityButton: {
    padding: 4,
  },
  quantityText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222',
    minWidth: 30,
    textAlign: 'center',
  },
  removeButton: {
    padding: 4,
  },
  lineTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  lineTotalLabel: {
    fontSize: 14,
    color: '#666',
  },
  lineTotalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: ORANGE,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#222',
  },
  modalScrollView: {
    maxHeight: 400,
  },
  voucherOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  voucherOptionSelected: {
    backgroundColor: '#FFF3EB',
  },
  voucherOptionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#222',
  },
  voucherOptionDiscount: {
    fontSize: 14,
    fontWeight: '600',
    color: ORANGE,
    marginRight: 8,
  },
});
