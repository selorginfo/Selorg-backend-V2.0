package com.selorg.com

import android.graphics.Color
import android.os.Bundle
import android.view.ViewTreeObserver
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.view.WindowCompat
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.swmansion.rnscreens.fragment.restoration.RNScreensFragmentFactory

class MainActivity : ReactActivity() {

  override fun getMainComponentName(): String = "Selorg"

  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  override fun onCreate(savedInstanceState: Bundle?) {
    // Android 12+ always shows a splash window. Without installSplashScreen()
    // the starting_reveal leash can stick and hide MainActivity forever
    // (accessibility tree still works; screencap stays black).
    val splashScreen = installSplashScreen()
    splashScreen.setKeepOnScreenCondition { false }
    splashScreen.setOnExitAnimationListener { splashView -> splashView.remove() }

    // Switch off BootTheme before content inflates.
    setTheme(R.style.AppTheme)

    supportFragmentManager.fragmentFactory = RNScreensFragmentFactory()
    super.onCreate(null)

    window.decorView.setBackgroundColor(Color.WHITE)
    WindowCompat.setDecorFitsSystemWindows(window, true)

    // Tell the system the first frame is ready so starting_reveal can finish.
    val content = findViewById<android.view.View>(android.R.id.content)
    content.viewTreeObserver.addOnPreDrawListener(
        object : ViewTreeObserver.OnPreDrawListener {
          override fun onPreDraw(): Boolean {
            content.viewTreeObserver.removeOnPreDrawListener(this)
            reportFullyDrawn()
            return true
          }
        },
    )
  }
}
