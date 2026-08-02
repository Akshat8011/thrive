"""Regression tests for listing-accurate ratings + buyer review mining."""

import unittest

from buy_routes import _extract_buyer_insights, _extract_rating_bundle, _parse_count


FIXTURE = """
Title: Fire-Boltt Ninja Call Pro Bluetooth Calling Smart Watch

Sponsored
[_3.6 out of 5 stars_](https://www.amazon.in/product-reviews/B0OTHERAS1)
[_4.3 out of 5 stars_ 5,432](https://www.amazon.in/product-reviews/B0OTHERAS2)

| Customer Reviews | [3.9 _3.9 out of 5 stars_](javascript:void(0))[(134,486)](https://www.amazon.in/dp/B09YV4RG4D#averageCustomerReviewsAnchor) 3.9 out of 5 stars |

3.9 out of 5 stars, 134,486 ratings

## Customer reviews

_3.9 out of 5 stars_

3.9 out of 5

134,486 global ratings

*   [5 star 4 star 3 star 2 star 1 star 5 star 51%20%11%4%14%51%](https://www.amazon.in/portal/customer-reviews/B09YV4RG4D/ref=acr_dp_hist_5)

### Customers say

Customers find the smartwatch to be of good quality and worth the price, appreciating its premium finish, many sports features, and smooth touch screen operation. The display and battery life receive mixed feedback.

9494 customers mention quality, 8371 positive, 1123 negative 9,494 customers mention "Quality"8,371 positive 1,123 negative
1784 customers mention battery life, 942 positive, 842 negative 1,784 customers mention "Battery life"942 positive 842 negative
3747 customers mention value for money, 3386 positive, 361 negative 3,747 customers mention "Value for money"3,386 positive 361 negative

Top reviews from India

*   
[Abhishek](https://www.amazon.in/gp/profile/x) _5 out of 5 stars_ ##### [Should buy it](https://www.amazon.in/portal/customer-reviews/srp/-/R1)Reviewed in India on 21 July 2026 [Colour: Black Gold](https://x)[Verified Purchase](https://x)  Brief content visible, double tap to read full content. Full content visible, double tap to read brief content. Its been 2 years i guess and still iam using it because it is a very good quality . And display is large and very good connectivity.       [Read more Read less](javascript:void(0))

*   
[Anil](https://www.amazon.in/gp/profile/y) _1 out of 5 stars_ ##### [Just a Toy for Children](https://www.amazon.in/portal/customer-reviews/srp/-/R2)Reviewed in India on 2 June 2026 [Verified Purchase](https://x) Well, I am not interested to explain in details. But have spent lot of money and have unlimited number of demerits. Battery dies fast.

[4.6 | 2,46,421](https://www.flipkart.com/ratings-reviews-details-page?pid=MOB)
"""


class BuyReviewTests(unittest.TestCase):
    def test_parse_count_indian_and_k(self):
        self.assertEqual(_parse_count('2,46,421'), 246421)
        self.assertEqual(_parse_count('9.4K'), 9400)
        self.assertEqual(_parse_count('134,486'), 134486)

    def test_ignores_related_product_stars(self):
        bundle = _extract_rating_bundle(FIXTURE, asin='B09YV4RG4D')
        self.assertEqual(bundle['rating'], 3.9)
        self.assertEqual(bundle['review_count'], 134486)
        self.assertGreaterEqual(bundle['confidence'], 90)
        # Must NOT pick sponsored 4.3 / 3.6
        self.assertNotEqual(bundle['rating'], 4.3)
        self.assertNotEqual(bundle['rating'], 3.6)

    def test_star_breakdown(self):
        bundle = _extract_rating_bundle(FIXTURE, asin='B09YV4RG4D')
        self.assertEqual(bundle['star_breakdown']['5'], 51)
        self.assertEqual(bundle['star_breakdown']['1'], 14)

    def test_buyer_insights_pros_cons_and_samples(self):
        insights = _extract_buyer_insights(FIXTURE, asin='B09YV4RG4D')
        self.assertTrue(insights['customers_say'])
        pro_names = {p['text'].lower() for p in insights['pros']}
        con_names = {c['text'].lower() for c in insights['cons']}
        self.assertIn('quality', pro_names)
        self.assertIn('value for money', pro_names)
        self.assertIn('battery life', con_names)
        self.assertGreaterEqual(len(insights['sample_reviews']), 2)
        titles = {s['title'].lower() for s in insights['sample_reviews']}
        self.assertIn('should buy it', titles)
        self.assertIn('just a toy for children', titles)

    def test_flipkart_pipe_rating(self):
        bundle = _extract_rating_bundle('[4.6 | 2,46,421](https://www.flipkart.com/x)', asin=None)
        self.assertEqual(bundle['rating'], 4.6)
        self.assertEqual(bundle['review_count'], 246421)


if __name__ == '__main__':
    unittest.main()
