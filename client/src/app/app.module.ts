import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AudioStreamer } from 'src/app/app.service';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AppComponent } from './app.component';

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    FormsModule,
    ReactiveFormsModule
  ],
  providers: [AudioStreamer],
  bootstrap: [AppComponent]
})
export class AppModule { }
