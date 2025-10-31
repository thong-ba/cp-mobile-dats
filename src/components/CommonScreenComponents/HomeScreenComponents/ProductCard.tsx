import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { COLORS } from '../../../constants/color';

const ProductCard = ({ name, price, image }: { name: string; price: number; image: any }) => (
  <TouchableOpacity style={styles.card}>
    <Image source={image} style={styles.image} resizeMode="contain" />
    <Text style={styles.name}>{name}</Text>
    <Text style={styles.price}>{price.toLocaleString()}₫</Text>
  </TouchableOpacity>
);

export default ProductCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 10,
    padding: 10,
    margin: 8,
    flex: 1,
    alignItems: 'center',
  },
  image: {
    width: 100,
    height: 100,
  },
  name: {
    color: COLORS.text,
    fontSize: 14,
    marginVertical: 5,
    textAlign: 'center',
  },
  price: {
    color: COLORS.primary,
    fontWeight: 'bold',
  },
});
