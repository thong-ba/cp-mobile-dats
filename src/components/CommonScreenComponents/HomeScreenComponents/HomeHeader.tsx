import React from 'react';
import { StyleSheet, View } from 'react-native';
import SearchBar from './SearchBar';

const ORANGE = '#FF6A00';

const HomeHeader = () => {
  return (
    <View style={styles.header}>
      {/* <Text style={styles.appTitle}>DATS Application</Text>
      <Text style={styles.subtitle}>Âm thanh chất lượng cho mọi khoảnh khắc</Text> */}
      <View>
        <SearchBar />
      </View>
    </View>
  );
};

export default HomeHeader;

const styles = StyleSheet.create({
  header: {
    backgroundColor: ORANGE,
    paddingTop: 25,
    paddingBottom: 2,
    paddingHorizontal: 12,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  appTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    color: '#FFE9D6',
    marginTop: 4,
  },
});

