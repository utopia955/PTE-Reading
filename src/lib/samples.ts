import { SavedQuestion } from "../types";

export const sampleQuestions: { [key: number]: Omit<SavedQuestion, "id" | "date" | "timestamp"> } = {
  1: {
    title: "Question type: Fill in the Blanks (Reading)",
    category: "FIB-R",
    note: "نمونه متداول سوال ریدینگ جای خالی. به ساختار حروف اضافه دقت شود.",
    status: "needs-review",
    images: ["https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&q=80&w=400"],
    rawResponse: JSON.stringify({
      step1_questionType: "Fill in the Blanks (Reading)",
      fullPassageTranslation: "Global trade networks have expanded rapidly in the last century, which has forced many organizations to adapt to diverse international regulations and reach a compromise to minimize risks. This connection has had a profound impact on social structures worldwide.\n\nشبکه‌های تجارت جهانی در قرن گذشته به سرعت گسترش یافته‌اند، که این امر بسیاری از سازمان‌ها را مجبور کرده است تا خود را با مقررات متنوع بین‌المللی سازگار کنند و برای به حداقل رساندن ریسک‌ها به یک مصالحه یا توافق برسند. این پیوندهای متقابل، تأثیر عمیقی بر ساختارهای اجتماعی در سراسر جهان گذاشته است.",
      step2_collocations: [
        {
          englishCollocation: "play a crucial role",
          persianMeaning: "نقش حیاتی ایفا کردن",
          importance: "یکی از پرتکرارترین کالوکیشن‌های آکادمیک در بخش ریدینگ پیرسون است.",
          example: "Nutrients play a crucial role in maintaining overall health."
        },
        {
          englishCollocation: "reach a compromise",
          persianMeaning: "رسیدن به توافق یا مصالحه",
          importance: "در متون سیاسی یا مذاکرات تجاری به شدت در جای خالی قرار می‌گیرد.",
          example: "After hours of discussions, the delegates managed to reach a compromise."
        },
        {
          englishCollocation: "profound impact",
          persianMeaning: "تاثیر عمیق",
          importance: "حرف اضافه آن معمولاً on است و با افعالی مثل have یا make به کار می‌رود.",
          example: "Technological advancements have had a profound impact on social connections."
        }
      ],
      step2_hardWords: [
        {
          word: "profound",
          phonetic: "/prəˈfaʊnd/",
          meaning: "عمیق، ژرف، اساسی (صفت)",
          example: "The scientific discovery had a profound impact on humanity."
        },
        {
          word: "compromise",
          phonetic: "/ˈkɒm.prə.maɪz/",
          meaning: "مصالحه، سازش، توافق مابین (اسم/فعل)",
          example: "We had to reach a compromise to complete the project."
        }
      ],
      step3_sentenceParsing: [
        {
          englishSentence: "Global trade networks have expanded rapidly in the last century, which has forced many organizations to adapt to diverse international regulations.",
          persianTranslation: "شبکه‌های تجارت جهانی در قرن گذشته به سرعت گسترش یافته‌اند، که این امر بسیاری از سازمان‌ها را مجبور کرده است تا با مقررات متنوع بین‌المللی سازگار شوند.",
          grammarStructure: "استفاده از زمان حال کامل (present perfect tense) و بند موصولی غیر توصیفی (which) برای توصیف کل جمله قبلی.",
          paragraphRole: "جمله آغازین یا مقدماتی (Background) برای توصیف فضا.",
          signalWords: "rapidly, which"
        },
        {
          englishSentence: "This connection has had a profound impact on social structures.",
          persianTranslation: "این پیوند فزاینده، تاثیر عمیقی روی ساختارهای اجتماعی داشته است.",
          grammarStructure: "ترکیب فعل گذرا با ساختار ثابت 'have had a profound impact on'.",
          paragraphRole: "جمله پشتیبان یا شرح دهنده جزییات (Supporting Sentence).",
          signalWords: "This connection"
        }
      ],
      step4_optionsBreakdown: [
        {
          blankNumber: "Blank 1 (adapt vs adopt)",
          options: [
            {
              optionWord: "adapt",
              isCorrect: true,
              explanation: "فعل adapt به همراه حرف اضافه to به معنای سازگار شدن است که با بافت گرامری و معنایی جمله تناسب کامل دارد."
            },
            {
              optionWord: "adopt",
              isCorrect: false,
              explanation: "فعل adopt گذرا است و به معنی پذیرفتن یا کودک را به فرزندی پذیرفتن است که در اینجا فاقد معنای مناسب است و با حرف اضافه to بکار نمی‌رود."
            }
          ]
        }
      ],
      step5_grammarTips: [
        {
          tipTitle: "قانون ثابت adapt + to",
          tipExplanation: "هر زمان فعل سازگاری یا تطبیق را دیدید، حرف اضافه بعد از آن معمولاً to است. پس دنبال ساختار اسمی باشید."
        },
        {
          tipTitle: "تفاوت adapt با adopt",
          tipExplanation: "کلمه اول به معنای وفق دادن و کلمه دوم به معنای اتخاذ یک روش یا تصویب قوانین جدید است."
        }
      ],
      step6_finalAnswers: [
        {
          blankName: "Blank 1",
          answer: "adapt"
        },
        {
          blankName: "Blank 2",
          answer: "reach"
        },
        {
          blankName: "Blank 3",
          answer: "profound"
        }
      ],
      confidenceLevel: "HIGH",
      confidenceReason: "تطابق کامل ساختار فعل و مفعول به همراه قیدهای متناسب با بافت متن رسمی آکادمیک."
    })
  },
  2: {
    title: "Question type: Fill in the Blanks (Reading & Writing)",
    category: "FIB-RW",
    note: "نمونه سوالات ریدینگ اند رایتینگ بخش گرامر و کلمات هم‌نشین.",
    status: "mastered",
    images: ["https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&q=80&w=400"],
    rawResponse: JSON.stringify({
      step1_questionType: "Fill in the Blanks (Reading & Writing)",
      fullPassageTranslation: "Language does not merely reflect reality; it also shapes how we perceive the universe around us and accurately conveys meanings. Those who can pass on information effectively are highly regarded.\n\nزبان صرفاً واقعیت را منعکس نمی‌کند؛ بلکه به نحوه درک ما از جهان اطراف به شکلی فعالانه شکل می‌دهد و معانی را به درستی انتقال می‌دهد. افرادی که می‌توانند اطلاعات را به شکلی کارآمد به دیگران منتقل کنند، بسیار مورد توجه هستند.",
      step2_collocations: [
        {
          englishCollocation: "accurately convey",
          persianMeaning: "به درستی انتقال دادن (مفهوم یا معنی)",
          importance: "ترکیب پرتکرار قید و فعل در آزمون‌های رسمی برای توضیح انتقال مفاهیم.",
          example: "Graphs can accurately convey complex scientific data in a simpler format."
        },
        {
          englishCollocation: "pass on information",
          persianMeaning: "انتشار یا انتقال دادن اطلاعات به دیگران",
          importance: "ساختار عبارتی فعل‌دار در رایتینگ و ریدینگ.",
          example: "We need an active system to pass on information to our remote colleagues."
        }
      ],
      step2_hardWords: [
        {
          word: "perceive",
          phonetic: "/pəˈsiːv/",
          meaning: "درک کردن، فهمیدن، حس کردن (فعل)",
          example: "We perceive the world differently based on our unique cultures."
        },
        {
          word: "convey",
          phonetic: "/kənˈveɪ/",
          meaning: "رساندن، انتقال دادن (مفهوم یا پیام) (فعل)",
          example: "It is important to convey your thoughts clearly to avoid misunderstandings."
        }
      ],
      step3_sentenceParsing: [
        {
          englishSentence: "Language does not merely reflect reality; it also shapes how we perceive the universe around us.",
          persianTranslation: "زبان صرفاً واقعیت را منعکس نمی‌کند؛ بلکه بر نحوه درک ما از جهان اطراف نیز تاثیر گذاشته و آن را شکل می‌دهد.",
          grammarStructure: "کاربرد ساختار موازی با ربط دهنده‌های همبستگی 'not merely ... but also'. شکل گیری تقابل دو بند مستقل.",
          paragraphRole: "بیان ادعای اصلی نویسنده (Thesis Statement).",
          signalWords: "not merely, also"
        }
      ],
      step4_optionsBreakdown: [
        {
          blankNumber: "Blank 1 (reflect vs deflect)",
          options: [
            {
              optionWord: "reflect",
              isCorrect: true,
              explanation: "انعکاس دادن واقعیت با کلمه reflect کاملاً صحیح است."
            },
            {
              optionWord: "deflect",
              isCorrect: false,
              explanation: "فعل deflect به معنی منحرف کردن است که نامربوط است."
            }
          ]
        }
      ],
      step5_grammarTips: [
        {
          tipTitle: "ساختار همبستگی Not Merely",
          tipExplanation: "معادل Not Only است و باید همان ساختار موازی موافق فاقد نفی را در قسمت دوم جمله ایجاد کند."
        }
      ],
      step6_finalAnswers: [
        {
          blankName: "Blank 1",
          answer: "reflect"
        },
        {
          blankName: "Blank 2",
          answer: "shapes"
        },
        {
          blankName: "Blank 3",
          answer: "perceive"
        }
      ],
      confidenceLevel: "HIGH",
      confidenceReason: "تطابق قیدها و تطابق سوم شخص مفرد افعال با توجه به گرامر فاعل مفرد."
    })
  }
};
