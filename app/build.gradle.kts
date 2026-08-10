plugins {
    id("com.android.application")
}

android {
    namespace = "com.almothanna.saudimarkettv"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.almothanna.saudimarkettv"
        minSdk = 23
        targetSdk = 35
        versionCode = 4
        versionName = "2.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
