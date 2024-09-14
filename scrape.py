import selenium.webdriver as webdriver
from selenium.webdriver.chrome.service import service
import time

def scrape_website(website):
    print("Launnching Chrome browser...")
    
    chrome_driver_path ="./setup.exe"
    options = webdriver.ChromeOptions( )
    driver = webdriver.Chrome(service=service(chrome_driver_path), options=options)
    
    try:
        driver.get(website)
        print("page loaded...")
        html = driver.page.source
        time.sleep(10)
        return html
    finally:
        driver.quit()