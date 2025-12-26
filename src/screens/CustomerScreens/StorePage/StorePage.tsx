import { MaterialCommunityIcons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Button, Chip, Searchbar, Snackbar } from 'react-native-paper';
import httpClient from '../../../api/httpClient';
import { useAuth } from '../../../context/AuthContext';
import { useChat } from '../../../context/ChatContext';
import { ProductStackParamList } from '../../../navigation/ProductStackNavigator';
import { getStoreById, StoreDetailResponse } from '../../../services/storeService';

const { width } = Dimensions.get('window');
const ORANGE = '#FF6A00';

type StorePageRouteProp = RouteProp<ProductStackParamList, 'Store'>;

const formatCurrencyVND = (value: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);

const StorePage: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<StorePageRouteProp>();
  const { storeId } = route.params;
  const { isAuthenticated } = useAuth();
  const { openChat } = useChat();

  const [storeData, setStoreData] = useState<StoreDetailResponse | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [storeLoading, setStoreLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // Extract unique categories from products
  const categories = useMemo(() => {
    const categorySet = new Set<string>();
    products.forEach((product: any) => {
      // ProductViewItem has categoryName directly
      if (product.categoryName) {
        categorySet.add(product.categoryName);
      }
    });
    return Array.from(categorySet);
  }, [products]);

  // Filter products by search and category
  const filteredProducts = useMemo(() => {
    let filtered = products;

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((product) => {
        const nameMatch = product.name?.toLowerCase().includes(query);
        const brandMatch = product.brandName?.toLowerCase().includes(query);
        const categoryMatch = product.categoryName?.toLowerCase().includes(query);
        return nameMatch || brandMatch || categoryMatch;
      });
    }

    // Filter by category
    if (selectedCategory) {
      filtered = filtered.filter((product: any) => product.categoryName === selectedCategory);
    }

    return filtered;
  }, [products, searchQuery, selectedCategory]);

  // Load store details
  const loadStore = useCallback(async () => {
    if (!storeId) return;

      try {
      setStoreLoading(true);
      const data = await getStoreById(storeId);
      console.log('[StorePage] Store data loaded:', {
        storeId: data.storeId,
        storeName: data.storeName,
        logoUrl: data.logoUrl,
        coverImageUrl: data.coverImageUrl,
      });
      setStoreData(data);
    } catch (error: any) {
      console.error('[StorePage] Failed to load store:', error);
      if (error?.response?.status === 404) {
        setSnackbarMessage('Không tìm thấy cửa hàng');
        setSnackbarVisible(true);
      } else {
        setSnackbarMessage('Không thể tải thông tin cửa hàng. Vui lòng thử lại.');
        setSnackbarVisible(true);
      }
    } finally {
      setStoreLoading(false);
    }
  }, [storeId]);

  // Load store products
  const loadProducts = useCallback(
    async (pageNum: number = 0, append: boolean = false) => {
      if (!storeId) return;

      try {
        if (!append) {
          setIsLoading(true);
        }

        const params: Record<string, any> = {
          storeId,
          status: 'ACTIVE',
          page: pageNum,
          size: 20,
        };

        const response = await httpClient.get<{
          status: number;
          message: string;
          data: {
            data: Array<{
              productId: string;
              name: string;
              thumbnailUrl?: string | null;
              images?: string[];
              price?: number | null;
              finalPrice?: number | null;
              ratingAverage?: number | null;
              reviewCount?: number | null;
              categoryName?: string;
              [key: string]: any;
            }>;
            page?: {
              pageNumber: number;
              pageSize: number;
              totalPages: number;
              totalElements: number;
            };
          };
        }>('/products/view', { params });

        const productItems = response.data?.data?.data || [];
        const pageInfo = response.data?.data?.page;
        
        console.log('[StorePage] Products loaded:', {
          count: productItems.length,
          firstProduct: productItems[0] ? {
            productId: productItems[0].productId,
            name: productItems[0].name,
            thumbnailUrl: productItems[0].thumbnailUrl,
            images: productItems[0].images,
          } : null,
        });

        if (append) {
          setProducts((prev) => [...prev, ...productItems]);
        } else {
          setProducts(productItems);
        }

        if (pageInfo) {
          setHasMore(pageInfo.pageNumber < pageInfo.totalPages - 1);
          setPage(pageInfo.pageNumber);
        } else {
          // Fallback: check if we got less than pageSize
          const pageSize = 20;
          setHasMore(productItems.length >= pageSize);
          setPage(pageNum);
        }
      } catch (error: any) {
        console.error('[StorePage] Failed to load products:', error);
        setSnackbarMessage('Không thể tải danh sách sản phẩm. Vui lòng thử lại.');
        setSnackbarVisible(true);
        if (!append) {
          setProducts([]);
        }
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [storeId],
  );

  // Initial load
  useEffect(() => {
    loadStore();
    loadProducts(0, false);
  }, [storeId, loadStore, loadProducts]);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    setPage(0);
    setHasMore(true);
    loadStore();
    loadProducts(0, false);
  }, [loadStore, loadProducts]);

  // Handle load more
  const handleLoadMore = useCallback(() => {
    if (!isLoading && hasMore && !isRefreshing && !searchQuery) {
      const nextPage = page + 1;
      loadProducts(nextPage, true);
    }
  }, [isLoading, hasMore, isRefreshing, searchQuery, page, loadProducts]);

  // Handle product click
  const handleProductClick = useCallback(
    (productId: string) => {
      // @ts-ignore - nested navigation
      navigation.navigate('ProductStack', {
        screen: 'ProductDetail',
        params: { productId },
      });
    },
    [navigation],
  );

  // Handle chat with store
  const handleChatWithStore = useCallback(() => {
    if (!isAuthenticated) {
      // @ts-ignore
      navigation.navigate('Auth', { screen: 'Login' });
      return;
    }
    // Open chat with store
    openChat('store', storeId, storeData?.storeName || 'Cửa hàng');
  }, [isAuthenticated, navigation, storeId, openChat, storeData]);

  // Get avatar URL
  const avatarUrl = storeData?.logoUrl
    ? storeData.logoUrl
    : `https://ui-avatars.com/api/?name=${encodeURIComponent(
        storeData?.storeName || 'Store',
      )}&background=ff6b35&color=fff&size=128`;

  // Get cover image URL
  const coverImageUrl = storeData?.coverImageUrl;

  // Render product card
  const renderProductCard = useCallback(
    ({ item }: { item: any }) => {
      const finalPrice = (item.finalPrice ?? item.price) || 0;
      const originalPrice = item.price || 0;
      const discountPercent =
        originalPrice > 0 && finalPrice < originalPrice
          ? Math.round(((originalPrice - finalPrice) / originalPrice) * 100)
          : null;

      return (
        <TouchableOpacity
          style={styles.productCard}
          onPress={() => handleProductClick(item.productId)}
          activeOpacity={0.7}
        >
          <Image
            source={{
              uri: (item as any).thumbnailUrl || (item as any).images?.[0] || 'https://placehold.co/200x200?text=Product',
            }}
            style={styles.productImage}
            resizeMode="cover"
          />
          <View style={styles.productInfo}>
            <Text style={styles.productName} numberOfLines={2}>
              {item.name || 'Sản phẩm'}
            </Text>
            <View style={styles.productPriceRow}>
              <Text style={styles.productPrice}>{formatCurrencyVND(finalPrice)}</Text>
              {discountPercent && (
                <Chip
                  style={styles.discountChip}
                  textStyle={styles.discountChipText}
                  compact
                >
                  -{discountPercent}%
                </Chip>
              )}
            </View>
            {(item.ratingAverage || item.reviewCount) && (
              <View style={styles.productRatingRow}>
                <MaterialCommunityIcons name="star" size={14} color="#FFB800" />
                <Text style={[styles.productRating, { marginLeft: 4 }]}>
                  {item.ratingAverage ? item.ratingAverage.toFixed(1) : '0.0'} ({item.reviewCount || 0})
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      );
    },
    [handleProductClick],
  );

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
      >
        {/* Cover Image Section */}
        <View style={styles.coverSection}>
          {coverImageUrl ? (
            <Image source={{ uri: coverImageUrl }} style={styles.coverImage} resizeMode="cover" />
          ) : (
            <View style={styles.coverPlaceholder} />
          )}
          <View style={styles.coverOverlay} />

          {/* Store Info Overlay */}
          <View style={styles.storeInfoOverlay}>
            <View style={styles.storeInfoLeft}>
              {storeLoading ? (
                <View style={styles.avatarContainer}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                </View>
              ) : (
                <TouchableOpacity activeOpacity={0.8}>
                  <Image source={{ uri: avatarUrl }} style={styles.storeAvatar} />
                </TouchableOpacity>
              )}
              <View style={styles.storeInfoText}>
                {storeLoading ? (
                  <View style={styles.storeNameSkeleton} />
                ) : (
                  <Text style={styles.storeNameOverlay}>{storeData?.storeName || 'Cửa hàng'}</Text>
                )}
                {storeData?.rating && (
                  <View style={styles.ratingRowOverlay}>
                    <MaterialCommunityIcons name="star" size={16} color="#FFB800" />
                    <Text style={[styles.ratingOverlay, { marginLeft: 4 }]}>
                      {storeData.rating.toFixed(1)}
                    </Text>
                  </View>
                )}
              </View>
            </View>
            <View style={styles.storeInfoRight}>
              <Searchbar
                placeholder="Tìm sản phẩm..."
                onChangeText={setSearchQuery}
                value={searchQuery}
                style={styles.searchBar}
                inputStyle={styles.searchInput}
              />
            </View>
          </View>
        </View>

        {/* Category Tabs */}
        {categories.length > 0 && (
          <View style={styles.categoryTabsContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryTabs}
            >
              <TouchableOpacity
                style={[
                  styles.categoryTab,
                  !selectedCategory && styles.categoryTabActive,
                ]}
                onPress={() => setSelectedCategory(null)}
              >
                <Text
                  style={[
                    styles.categoryTabText,
                    !selectedCategory && styles.categoryTabTextActive,
                  ]}
                >
                  Tất cả
                </Text>
              </TouchableOpacity>
              {categories.map((category) => (
                <TouchableOpacity
                  key={category}
                  style={[
                    styles.categoryTab,
                    selectedCategory === category && styles.categoryTabActive,
                  ]}
                  onPress={() => setSelectedCategory(category)}
                >
                  <Text
                    style={[
                      styles.categoryTabText,
                      selectedCategory === category && styles.categoryTabTextActive,
                    ]}
                  >
                    {category}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Products Section */}
        <View style={styles.productsSection}>
          {isLoading && products.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={ORANGE} />
              <Text style={styles.loadingText}>Đang tải sản phẩm...</Text>
            </View>
          ) : filteredProducts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons
                name="store-off-outline"
                size={64}
                color="#CCCCCC"
              />
              <Text style={styles.emptyText}>
                {searchQuery
                  ? `Không tìm thấy sản phẩm '${searchQuery}'`
                  : 'Cửa hàng chưa có sản phẩm nào'}
              </Text>
              {searchQuery && (
                <Button
                  mode="outlined"
                  onPress={() => setSearchQuery('')}
                  style={styles.clearSearchButton}
                >
                  Xóa tìm kiếm
                </Button>
              )}
            </View>
          ) : (
            <>
              <FlatList
                data={filteredProducts}
                renderItem={renderProductCard}
                keyExtractor={(item) => item.productId}
                numColumns={2}
                columnWrapperStyle={styles.productRow}
                scrollEnabled={false}
                contentContainerStyle={styles.productsList}
              />
              {hasMore && !searchQuery && (
                <Button
                  mode="contained"
                  onPress={handleLoadMore}
                  loading={isLoading}
                  disabled={isLoading}
                  style={styles.loadMoreButton}
                >
                  Xem thêm sản phẩm
                </Button>
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* Floating Chat Button */}
      {isAuthenticated && (
        <TouchableOpacity
          style={styles.floatingChatButton} 
          onPress={handleChatWithStore}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="message-text" size={24} color="#FFFFFF" />
          <Text style={styles.floatingChatButtonText}>Chat Ngay</Text>
        </TouchableOpacity>
      )}

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
      >
        {snackbarMessage}
      </Snackbar>
    </View>
  );
};

export default StorePage;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F7',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  coverSection: {
    height: 288,
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#FFEADB',
  },
  coverOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  storeInfoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  storeInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  storeAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  storeInfoText: {
    marginLeft: 12,
    flex: 1,
  },
  storeNameSkeleton: {
    width: 150,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 4,
    marginBottom: 4,
  },
  storeNameOverlay: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    marginBottom: 4,
  },
  ratingRowOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingOverlay: {
    fontSize: 14,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  storeInfoRight: {
    flex: 1,
    marginLeft: 16,
  },
  searchBar: {
    backgroundColor: '#FFFFFF',
    elevation: 4,
    borderRadius: 8,
  },
  searchInput: {
    fontSize: 14,
  },
  categoryTabsContainer: {
    backgroundColor: '#FFFFFF',
    marginTop: -40,
    marginHorizontal: 16,
    borderRadius: 12,
    elevation: 2,
    paddingVertical: 12,
  },
  categoryTabs: {
    paddingHorizontal: 16,
  },
  categoryTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  categoryTabActive: {
    backgroundColor: '#FFF3EB',
  },
  categoryTabText: {
    fontSize: 14,
    color: '#666',
  },
  categoryTabTextActive: {
    color: ORANGE,
    fontWeight: '600',
  },
  productsSection: {
    padding: 16,
    marginTop: 8,
  },
  loadingContainer: {
    padding: 32,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: '#666',
  },
  emptyContainer: {
    padding: 48,
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  clearSearchButton: {
    marginTop: 16,
    borderColor: ORANGE,
  },
  productsList: {
    paddingBottom: 16,
  },
  productRow: {
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  productCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    elevation: 2,
    maxWidth: (width - 48) / 2,
  },
  productImage: {
    width: '100%',
    height: 160,
    backgroundColor: '#F0F0F0',
  },
  productInfo: {
    padding: 12,
  },
  productName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#272727',
    marginBottom: 8,
    minHeight: 40,
  },
  productPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: ORANGE,
  },
  discountChip: {
    backgroundColor: '#FFEADB',
    height: 20,
  },
  discountChipText: {
    fontSize: 10,
    color: ORANGE,
    fontWeight: '600',
  },
  productRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  productRating: {
    fontSize: 12,
    color: '#666',
  },
  loadMoreButton: {
    marginTop: 16,
    backgroundColor: ORANGE,
  },
  floatingChatButton: {
    position: 'absolute',
    bottom: 80,
    right: 16,
    backgroundColor: ORANGE,
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  floatingChatButtonText: {
    marginLeft: 8,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

