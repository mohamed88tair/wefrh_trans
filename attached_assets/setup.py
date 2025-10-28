#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from setuptools import setup, find_packages
from pathlib import Path
import re

# قراءة README
this_directory = Path(__file__).parent
long_description = (this_directory / "README.md").read_text(encoding='utf-8')

# قراءة الإصدار من الكود
def get_version():
    version_file = this_directory / "main.py"
    if version_file.exists():
        content = version_file.read_text(encoding='utf-8')
        version_match = re.search(r'version.*?(\d+\.\d+\.\d+)', content)
        if version_match:
            return version_match.group(1)
    return "2.1.0"

setup(
    name="php-translator-advanced",
    version=get_version(),
    author="PHP Translator Team",
    author_email="support@example.com",
    description="مترجم ملفات PHP المتقدم باستخدام AI مع تحسينات الأداء والتكلفة",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/your-repo/php-translator",
    packages=find_packages(),
    classifiers=[
        "Development Status :: 5 - Production/Stable",
        "Intended Audience :: Developers",
        "Topic :: Software Development :: Localization", 
        "Topic :: Text Processing :: Linguistic",
        "Topic :: Software Development :: User Interfaces",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.7",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Operating System :: OS Independent",
        "Natural Language :: Arabic",
        "Natural Language :: English",
        "Environment :: X11 Applications :: Qt",
        "Intended Audience :: End Users/Desktop",
    ],
    python_requires=">=3.7",
    install_requires=[
        "PyQt5>=5.15.0",
        "requests>=2.28.0", 
        "psutil>=5.8.0",
    ],
    extras_require={
        "dev": [
            "pytest>=6.0",
            "black>=21.0",
            "flake8>=3.8",
            "mypy>=0.910",
        ],
        "performance": [
            "psutil>=5.8.0",
            "memory-profiler>=0.60.0",
        ],
        "testing": [
            "pytest>=6.0",
            "pytest-qt>=4.0",
            "pytest-cov>=3.0",
        ]
    },
    entry_points={
        "console_scripts": [
            "php-translator=main:main",
            "php-translator-test=test_performance:main",
        ],
        "gui_scripts": [
            "php-translator-gui=main:main",
        ]
    },
    include_package_data=True,
    package_data={
        "": [
            "*.md", 
            "*.txt", 
            "*.json", 
            "*.bat", 
            "*.sh",
            "requirements.txt",
            "QUICK_START.md",
            "README_UPDATED.md"
        ],
    },
    data_files=[
        ("", ["requirements.txt"]),
        ("docs", ["README.md", "QUICK_START.md", "README_UPDATED.md"]),
        ("scripts", ["start.bat", "start.sh"]),
    ],
    keywords=[
        "php", "translation", "localization", "l10n", "i18n",
        "ai", "gpt", "gemini", "arabic", "translator",
        "delivery", "food", "restaurant", "ecommerce",
        "laravel", "codeigniter", "symfony", "performance",
        "cost-optimization", "batch-processing", "gui",
        "desktop", "pyqt5", "automation"
    ],
    project_urls={
        "Bug Reports": "https://github.com/your-repo/php-translator/issues",
        "Source": "https://github.com/your-repo/php-translator",
        "Documentation": "https://github.com/your-repo/php-translator#readme",
        "Quick Start": "https://github.com/your-repo/php-translator/blob/main/QUICK_START.md",
        "Performance Guide": "https://github.com/your-repo/php-translator/blob/main/README_UPDATED.md",
        "Changelog": "https://github.com/your-repo/php-translator/releases",
        "Support": "mailto:support@example.com",
    },
    zip_safe=False,
    platforms=["any"],
    license="MIT",
    
    # معلومات إضافية للتثبيت
    options={
        "bdist_wheel": {
            "universal": False,
        }
    },
    
    # Scripts للتشغيل
    scripts=[
        "run.py",
        "test_performance.py"
    ],
    
    # معلومات تفصيلية
    long_description_content_type="text/markdown",
    
    # تعليمات التثبيت الإضافية
    cmdclass={},
    
    # متطلبات النظام
    install_package_data=True,
)