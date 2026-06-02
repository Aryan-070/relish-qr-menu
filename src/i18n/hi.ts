/**
 * Hindi (hi) translation dictionary — Devanagari.
 *
 * Typed as `Record<TranslationKey, string>` so TypeScript guarantees a
 * translation exists for EVERY key defined in {@link ../i18n/en.ts}. If a key is
 * added to English and not added here, this file fails to compile.
 *
 * Translations are written naturally for an Indian restaurant context
 * (e.g. 'action.addToOrder' → 'ऑर्डर में जोड़ें', 'order.total' → 'कुल').
 */
import type { TranslationKey } from './types'

export const hi: Record<TranslationKey, string> = {
  // ── Navigation ────────────────────────────────────────────────────────────
  'nav.menu': 'मेन्यू',
  'nav.askAI': 'AI से पूछें',
  'nav.waiter': 'वेटर',
  'nav.order': 'ऑर्डर',
  'nav.myOrder': 'मेरा ऑर्डर',
  'nav.callWaiter': 'वेटर बुलाएं',

  // ── Brand / tagline ───────────────────────────────────────────────────────
  'brand.name': 'रेलिश',
  'brand.tagline': 'अंतरराष्ट्रीय शाकाहारी व्यंजन',
  'brand.journey': 'दुनिया भर के स्वादों की एक यात्रा',

  // ── Generic actions ───────────────────────────────────────────────────────
  'action.addToOrder': 'ऑर्डर में जोड़ें',
  'action.addCombo': 'कॉम्बो जोड़ें',
  'action.placeOrder': 'वेटर के साथ ऑर्डर दें',
  'action.continue': 'जारी रखें',
  'action.next': 'आगे',
  'action.startOver': 'फिर से शुरू करें',
  'action.search': 'खोजें',
  'action.openMenu': 'मेन्यू खोलें',
  'action.exploreMenu': 'मेन्यू देखें',
  'action.browseMenu': 'मेन्यू ब्राउज़ करें',
  'action.askWaiter': 'वेटर से पूछें',
  'action.showMyPicks': 'मेरी पसंद दिखाएं',
  'action.recommend': 'कुछ सुझाएं',
  'action.askForRecommendation': 'सुझाव के लिए पूछें',
  'action.viewInMenu': 'मेन्यू में देखें',
  'action.done': 'हो गया',
  'action.close': 'बंद करें',
  'action.back': 'पीछे',
  'action.tapToClose': 'बंद करने के लिए कहीं भी टैप करें',
  'action.tapToAdd': 'अपने ऑर्डर में जोड़ने के लिए टैप करें',
  'action.tapDishToAdd': 'किसी भी व्यंजन को यहाँ जोड़ने के लिए टैप करें',
  'action.addedToOrder': 'आपके ऑर्डर में जोड़ा गया',
  'action.showToWaiter': 'वेटर को दिखाएं',

  // ── Landing screen ────────────────────────────────────────────────────────
  'landing.tonightsTable': 'आज की मेज़',
  'landing.recommendShort': 'सुझाएं',
  'landing.callWaiter': 'वेटर बुलाएं',

  // Trust badges / facts
  'landing.badgeVeg': '100% शाकाहारी',
  'landing.badgeJain': 'जैन विकल्प',
  'landing.badgeFresh': 'रोज़ ताज़ा',
  'landing.badgePairings': 'चुनिंदा जोड़ियाँ',

  // Hero taglines / chrome (per landing variant)
  'landing.gastronomiqueTagline': 'जहाँ हर थाली शिल्प और संस्कृति की कहानी कहती है',
  'landing.gastronomiqueVol': 'फ़ाइन डाइनिंग · खंड I',
  'landing.gastronomiqueChefSignature': 'शेफ़ का हस्ताक्षर',
  'landing.gastronomiqueFooter': 'अंतरराष्ट्रीय शाकाहारी व्यंजन · स्थापित 2024 · प्रेम से तैयार',
  'landing.editorialDining': 'रेलिश डाइनिंग',
  'landing.editorialVol': 'खंड I',
  'landing.editorialTagline': 'दुनिया के बेहतरीन शाकाहारी व्यंजनों की एक यात्रा',
  'landing.editorialBlurb': 'पाँच श्रेणियाँ। साठ व्यंजन प्रेम से तैयार। एक अविस्मरणीय भोजन अनुभव।',
  'landing.editorialQuote': 'जहाँ हर थाली संस्कृति, शिल्प और शुद्ध शाकाहारी आनंद की कहानी कहती है।',
  'landing.editorialFooter': 'अंतरराष्ट्रीय शाकाहारी व्यंजन • ब्राउज़ करने के लिए स्कैन करें • स्थापित 2024',
  'landing.est': 'स्थापित 2024',
  'landing.botanicaTagline': 'खेत से ताज़ा · मौसमी · प्रेम से तैयार',
  'landing.botanicaFarmToTable': 'खेत से मेज़ तक',
  'landing.reelTagline': 'हर व्यंजन, गति में',
  'landing.intlVegCuisine': 'अंतरराष्ट्रीय शाकाहारी व्यंजन',

  // ── Item detail ───────────────────────────────────────────────────────────
  'item.suitableFor': 'इनके लिए उपयुक्त',
  'item.contains': 'इसमें शामिल है',
  'item.allergyNote': 'गंभीर एलर्जी के लिए कृपया अपने सर्वर से पुष्टि करें।',
  'item.goesWellWith': 'इसके साथ अच्छा लगता है',
  'item.pickOne': 'एक चुनें',
  'item.drink': 'पेय',
  'item.side': 'साइड',
  'item.dessert': 'मिठाई',
  'item.jain': 'जैन',
  'item.canBeJain': 'जैन बन सकता है',
  'item.jainable': 'जैन-योग्य',
  'item.addShort': 'जोड़ें',

  // ── Order panel ───────────────────────────────────────────────────────────
  'order.title': 'आपका ऑर्डर',
  'order.total': 'कुल',
  'order.taxesExtra': 'कर और सेवा शुल्क अतिरिक्त',
  'order.empty': 'आपका ऑर्डर खाली है',
  'order.nothingAdded': 'अभी कुछ नहीं जोड़ा गया',
  'order.handToWaiter': 'इसे अपने वेटर को दिखाएं या बुलाने के लिए टैप करें',
  'order.callingWaiter': 'वेटर को बुला रहे हैं…',
  'order.addNote': 'विशेष निर्देश जोड़ें',
  'order.editNote': 'विशेष निर्देश संपादित करें',
  'order.notePlaceholder': 'जैसे कम तीखा, बिना प्याज़, अतिरिक्त सॉस…',
  'order.itemSingular': 'वस्तु',
  'order.itemPlural': 'वस्तुएं',
  'order.payBill': 'बिल भरें',

  // ── Checkout / pay-at-table ───────────────────────────────────────────────
  'checkout.title': 'अपना बिल भरें',
  'checkout.subtitle': 'अपने फ़ोन से ही भुगतान करें',
  'checkout.subtotal': 'उप-योग',
  'checkout.serviceCharge': 'सेवा शुल्क',
  'checkout.gst': 'जीएसटी',
  'checkout.cgst': 'सीजीएसटी',
  'checkout.sgst': 'एसजीएसटी',
  'checkout.tip': 'टिप',
  'checkout.total': 'कुल देय',
  'checkout.splitLabel': 'बिल बाँटें',
  'checkout.splitNone': 'मैं पूरा भुगतान करूँगा',
  'checkout.splitEven': 'बराबर बाँटें',
  'checkout.splitWays': 'हिस्से',
  'checkout.perPerson': 'प्रति व्यक्ति',
  'checkout.tipLabel': 'टिप जोड़ें',
  'checkout.tipNone': 'कोई टिप नहीं',
  'checkout.payNow': 'भुगतान करें',
  'checkout.processing': 'प्रोसेस हो रहा है…',
  'checkout.paid': 'भुगतान हो गया — धन्यवाद!',
  'checkout.failed': 'भुगतान विफल। कृपया पुनः प्रयास करें।',
  'checkout.dismissed': 'भुगतान रद्द किया गया',
  'checkout.demoNote': 'डेमो मोड — कोई वास्तविक शुल्क नहीं लिया जाता',
  'checkout.secured': 'सुरक्षित भुगतान',
  'checkout.upsellTitle': 'कुछ मीठा जोड़ें?',
  'checkout.add': 'जोड़ें',

  // ── Service panel ─────────────────────────────────────────────────────────
  'service.title': 'टेबल सेवा',
  'service.howCanWeHelp': 'हम आपकी कैसे मदद कर सकते हैं?',
  'service.welcome': 'रेलिश में आपका स्वागत है',
  'service.callOurWaiter': 'हमारे वेटर को बुलाएं',
  'service.anytime': 'कभी भी',
  'service.atYourService': 'आपकी सेवा में',
  'service.tapAny': 'कोई भी टैप करें',
  'service.tonightsRequests': 'आज की विनतियाँ',
  'service.waiterEnRoute': 'वेटर रास्ते में',
  'service.waiterOnTheWay': 'आपका वेटर आ रहा है',
  'service.requestReceived': 'विनती प्राप्त हुई',
  'service.arrived': 'पहुँच गए!',
  'service.eta': 'अनुमानित समय',
  'service.hide': 'छिपाएं',
  'service.cancelRequest': 'विनती रद्द करें',

  // Service grid cards
  'service.water': 'पानी',
  'service.waterSub': 'सादा · सोडा',
  'service.bill': 'बिल',
  'service.billSub': 'बाँटें · भुगतान',
  'service.more': 'और',
  'service.moreSub': 'जैन · आदि',
  'service.menuSub': 'ब्राउज़ करें',
  'service.askAISub': 'रेलिश गाइड',
  'service.empty': 'खाली',

  // Water view
  'service.requestWater': 'पानी मंगाएं',
  'service.waterStill': 'सादा',
  'service.waterSparkling': 'सोडा',
  'service.waterIce': '+ बर्फ',
  'service.waterLemon': '+ नींबू',

  // Bill view
  'service.billPrintNote': 'हम इसे प्रिंट करके ले आएंगे। कोई जल्दी नहीं।',
  'service.billOneBill': 'एक बिल',
  'service.billSplitEvenly': 'बराबर बाँटें',
  'service.billItemise': 'मद अनुसार',
  'service.billGratuity': 'टिप जोड़ें',

  // Split-bill calculator
  'service.splitTitle': 'बिल बाँटें',
  'service.splitEachPays': 'हर व्यक्ति भुगतान करे',
  'service.splitBetween': 'इनमें बाँटें',
  'service.splitAddTip': 'टिप जोड़ें',
  'service.splitTipNone': 'कोई नहीं',
  'service.splitRoundUp': 'स्टाफ़ के लिए राउंड अप करें',
  'service.splitRoundUpSub': 'प्रत्येक निकटतम ₹10 · अतिरिक्त टिप में जाता है',
  'service.splitSubtotal': 'ऑर्डर उप-योग',
  'service.splitTip': 'टिप',
  'service.splitTableTotal': 'मेज़ का कुल',
  'service.splitNothingYet': 'अभी बाँटने के लिए कुछ नहीं',
  'service.personSingular': 'व्यक्ति',
  'service.personPlural': 'व्यक्ति',

  // More view
  'service.moreTitle': 'और विकल्प',
  'service.bread': 'ब्रेड बास्केट',
  'service.breadSub': 'गरम साॅवरडो',
  'service.jainInfo': 'जैन जानकारी',
  'service.jainInfoSub': 'मेन्यू विवरण',
  'service.allergyNote': 'एलर्जी सूचना',
  'service.allergyNoteSub': 'रसोई को सूचित करें',
  'service.compliments': 'प्रशंसा',
  'service.complimentsSub': 'शेफ़ के लिए',
  'service.helpChoosing': 'चुनने में मदद',
  'service.helpChoosingSub': 'हमारी टीम से पूछें',
  'service.coatCheck': 'कोट चेक',
  'service.coatCheckSub': 'वापस लें',

  // Greetings
  'service.goodMorning': 'सुप्रभात,',
  'service.goodAfternoon': 'नमस्कार,',
  'service.goodEvening': 'शुभ संध्या,',

  // Service panel — additional chrome
  'service.tableGuests': 'मेज़ 7 · 2 अतिथि',
  'service.requestReceivedTable': 'विनती प्राप्त हुई · मेज़ 7',
  'service.waiterPrefix': 'आपका वेटर ',
  'service.waiterOnWay': 'रास्ते में है',

  // Water option subs
  'service.waterStillSub': 'झरने का, कमरे के तापमान पर',
  'service.waterSparklingSub': 'अच्छी तरह ठंडा',
  'service.waterIceSub': 'अतिरिक्त बर्फ़',
  'service.waterLemonSub': 'ताज़ा फाँक',

  // Bill option subs
  'service.billOneBillSub': 'पूरी मेज़ के लिए',
  'service.billSplitEvenlySub': '2 हिस्सों में',
  'service.billItemiseSub': 'प्रति व्यंजन',
  'service.billGratuitySub': '10 / 18 / 20%',
  'service.billCalculateShares': 'हिस्से गिनें',

  // Bread view
  'service.breadTitle': 'ब्रेड और साॅवरडो',
  'service.sourdough': 'साॅवरडो',
  'service.sourdoughSub': 'गरम बास्केट',
  'service.moreBread': 'और ब्रेड',
  'service.moreBreadSub': 'कृपया फिर से भरें',

  // Jain view
  'service.jainTitle': 'जैन मेन्यू विवरण',
  'service.jainAvailable': 'जैन-अनुकूल विकल्प उपलब्ध',
  'service.jainInformWaiter': 'ऑर्डर देने से पहले हमेशा अपने वेटर को सूचित करें',
  'service.jainQ1': 'जैन भोजन क्या है?',
  'service.jainA1': 'जैन व्यंजन में जड़ वाली सब्ज़ियाँ (प्याज़, लहसुन, आलू, गाजर, मूली) और जीवों को नुकसान पहुँचाने वाली कोई भी सामग्री नहीं होती।',
  'service.jainQ2': 'कौन से व्यंजन पूरी तरह जैन हैं?',
  'service.jainA2': 'जैन बैज से चिह्नित व्यंजन बिना किसी जड़ वाली सब्ज़ी के बनाए जाते हैं। मेन्यू पर हरे "जैन" बैज को देखें।',
  'service.jainQ3': 'क्या व्यंजन जैन बनाए जा सकते हैं?',
  'service.jainA3': 'कई व्यंजनों पर "जैन बन सकता है" लिखा है — इन्हें अनुरोध पर जैन-अनुकूल बनाया जा सकता है। कृपया ऑर्डर देने से पहले अपने वेटर को सूचित करें।',
  'service.jainQ4': 'क्रॉस-कंटैमिनेशन?',
  'service.jainA4': 'हमारी रसोई जैन ऑर्डर का ध्यान रखती है, पर हम साझा रसोई का उपयोग करते हैं। सख़्त ज़रूरतों के लिए कृपया वेटर से बात करें।',
  'service.jainStillQuestions': 'अब भी सवाल हैं? वेटर बुलाएं',

  // Split-bill — additional
  'service.splitTipNoneShort': 'कोई नहीं',
  'service.splitEmptyDesc': 'अपने ऑर्डर में कुछ व्यंजन जोड़ें और हम सबका हिस्सा निकाल देंगे।',
  'service.splitBrowseMenu': 'मेन्यू ब्राउज़ करें',
  'service.splitTotal': 'कुल',
  'service.splitCtaPrefix': 'बिल मंगाएं — ',
  'service.splitWays': 'हिस्सों में बाँटें',
  'service.splitPerPerson': '/व्यक्ति',
  'service.decrease': 'घटाएं',
  'service.increase': 'बढ़ाएं',
  'service.goBack': 'पीछे जाएं',
  'service.close': 'बंद करें',

  // Toast / status messages
  'service.toastStill': 'सादा पानी, रास्ते में।',
  'service.toastSparkling': 'सोडा, अच्छी तरह ठंडा।',
  'service.toastIce': 'अतिरिक्त बर्फ़ — आ रही है।',
  'service.toastLemon': 'नींबू की एक फाँक — आ रही है।',
  'service.toastWhole': 'एक बिल, रास्ते में।',
  'service.toastSplit': 'बिल बाँटा गया — आपके वेटर को भेजा गया।',
  'service.toastItemize': 'बिल को मद अनुसार बना रहे हैं।',
  'service.toastGratuity': 'काउंटर पर टिप जोड़ें।',
  'service.toastBread': 'और ब्रेड — आ रही है।',
  'service.toastAllergy': 'रसोई को सूचित किया। वेटर पुष्टि करेगा।',
  'service.toastCompliment': 'प्रशंसा रसोई तक पहुँचाई गई।',
  'service.toastChoose': 'वेटर जल्द ही आपके पास आएगा।',
  'service.toastCoat': 'आपके कोट ला रहे हैं।',
  'service.toastWaiter': 'वेटर को बुला लिया गया!',
  'service.toastCancel': 'रद्द किया गया — कोई वेटर नहीं आ रहा।',
  'service.toastNoted': 'नोट किया — रास्ते में।',

  // Feed labels (live requests)
  'service.feedTableSeated': 'मेज़ पर बैठे',
  'service.feedMenusDelivered': 'मेन्यू पहुँचाए गए',
  'service.feedWaiterCalled': 'वेटर बुलाया गया',
  'service.feedDone': '— हो गया',
  'service.feedCancelled': '— रद्द',
  'service.feedWaiterEta': '~45 सेकंड',
  'service.feedEta2min': '2 मिनट',

  // ── Recommendation flow ───────────────────────────────────────────────────
  'reco.title': 'रेलिश AI से पूछें',
  'reco.subtitle': 'व्यक्तिगत सुझाव',
  'reco.picksTitle': 'आपकी रेलिश पसंद',
  'reco.picksSubtitle': 'आपकी पसंद के आधार पर',
  'reco.topPick': 'आपके लिए सर्वोत्तम पसंद',
  'reco.chefsPicks': 'शेफ की पसंद',
  'reco.selectToContinue': 'जारी रखने के लिए कम से कम एक विकल्प चुनें',
  'reco.everythingWorthTrying': 'हमारे मेन्यू में हर चीज़ चखने लायक है!',
  'reco.notSureWhat': 'क्या ऑर्डर करें, तय नहीं कर पा रहे?',
  'reco.moodQuestion': 'आपका किस चीज़ का मन है?',
  'reco.moodHint': 'जितने चाहें उतने चुनें',
  'reco.partyQuestion': 'आप किसके लिए ऑर्डर कर रहे हैं?',
  'reco.partyHint': 'जो लागू हों सभी चुनें',

  // ── Search ────────────────────────────────────────────────────────────────
  'search.placeholder': "व्यंजन खोजें, जैसे 'आम' या 'तीखा'",
  'search.noMatch': 'कोई व्यंजन मेल नहीं खाता',
  'search.tryDifferent': 'कोई दूसरा शब्द आज़माएं या फ़िल्टर हटाएं।',
  'search.dishSingular': 'व्यंजन',
  'search.dishPlural': 'व्यंजन',
  'search.onTheMenu': 'मेन्यू में',
  'search.mildOnly': 'केवल हल्का',

  // ── Generic empty / state copy ────────────────────────────────────────────
  'state.basedOnPreferences': 'आपकी पसंद के आधार पर',

  // ── Feedback / review / social ────────────────────────────────────────────
  'service.feedbackTitle': 'अपनी विज़िट को रेट करें',
  'service.rateUs': 'हमें रेट करें',
  'service.rateUsSub': 'समीक्षा · फ़ॉलो',
  'feedback.rateVisit': 'भोजन हो गया? अपनी विज़िट रेट करें',
  'feedback.q': 'आपका अनुभव कैसा रहा?',
  'feedback.tapRate': 'रेट करने के लिए स्टार टैप करें',
  'feedback.loved': 'जानकर बहुत खुशी हुई!',
  'feedback.lovedSub': 'क्या आप इसे Google पर साझा करेंगे? यह हमारे लिए बहुत मायने रखता है।',
  'feedback.google': 'Google पर हमें रेट करें',
  'feedback.improve': 'क्षमा करें, यह बेहतर हो सकता था',
  'feedback.improveSub': 'बताएं हम क्या बेहतर कर सकते हैं — यह सीधे मैनेजर तक पहुंचेगा।',
  'feedback.commentPlaceholder': 'टिप्पणी जोड़ें (वैकल्पिक)',
  'feedback.send': 'प्रतिक्रिया भेजें',
  'feedback.thanks': 'आपकी प्रतिक्रिया के लिए धन्यवाद!',
  'feedback.thanksSub': 'हमारे यहाँ भोजन करने के लिए धन्यवाद।',
  'feedback.followUs': 'Instagram पर हमें फ़ॉलो करें',

  // ── Loyalty / rewards ─────────────────────────────────────────────────────
  'service.rewards': 'रिवॉर्ड्स',
  'service.rewardsSub': 'पॉइंट · टियर',
  'service.rewardsTitle': 'Relish रिवॉर्ड्स',
  'loyalty.title': 'Relish रिवॉर्ड्स',
  'loyalty.subtitle': 'हर विज़िट पर पॉइंट कमाएं',
  'loyalty.phonePlaceholder': 'आपका फ़ोन नंबर',
  'loyalty.namePlaceholder': 'आपका नाम (वैकल्पिक)',
  'loyalty.continue': 'आगे बढ़ें',
  'loyalty.welcome': 'Relish रिवॉर्ड्स में आपका स्वागत है!',
  'loyalty.welcomeSub': 'आपने 50 स्वागत पॉइंट कमाए हैं।',
  'loyalty.points': 'पॉइंट',
  'loyalty.visits': 'विज़िट',
  'loyalty.tier': 'टियर',
  'loyalty.redeem': '100 पॉइंट रिडीम करें',
  'loyalty.redeemed': '100 पॉइंट रिडीम किए गए',
  'loyalty.earnHint': 'हर ₹10 खर्च पर 1 पॉइंट कमाएं।',
}
